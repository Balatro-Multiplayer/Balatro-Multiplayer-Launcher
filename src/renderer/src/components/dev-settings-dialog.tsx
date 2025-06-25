import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { toast } from 'sonner'
import { settingsService } from '@renderer/servicies/settings.service'

interface DevSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Define a query key for dev settings
const devSettingsQueryKey = ['dev-settings']

// Create a query option for dev settings
export const devSettingsQueryOptions = {
  queryKey: devSettingsQueryKey,
  queryFn: () => settingsService.getAllSettings(),
  enabled: false // Will be updated in the component
}

export function DevSettingsDialog({ open, onOpenChange }: DevSettingsDialogProps) {
  const queryClient = useQueryClient()
  const [isDev, setIsDev] = useState(false)
  const { data: settings, isLoading } = useQuery({
    ...devSettingsQueryOptions,
    enabled: isDev
  })
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({})

  useEffect(() => {
    // Check if we're in development mode
    window.api.isDev().then(setIsDev).catch(console.error)
  }, [])

  // Initialize the edited settings when the dialog opens and data is loaded
  useEffect(() => {
    if (settings && open) {
      setEditedSettings({ ...settings })
    }
  }, [settings, open])

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) =>
      settingsService.setSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: devSettingsQueryKey })
      toast.success('Setting updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update setting: ${error}`)
    }
  })

  const handleSave = () => {
    // Compare edited settings with original settings and update only changed ones
    if (settings) {
      const promises = Object.entries(editedSettings).map(([key, value]) => {
        if (JSON.stringify(settings[key]) !== JSON.stringify(value)) {
          return updateSettingMutation.mutateAsync({ key, value })
        }
        return Promise.resolve()
      })

      Promise.all(promises)
        .then(() => {
          toast.success('All settings updated successfully')
          onOpenChange(false)
        })
        .catch((error) => {
          toast.error(`Failed to update some settings: ${error}`)
        })
    }
  }

  const handleChange = (key: string, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  // Render a form control based on the type of the setting
  const renderSettingControl = (key: string, value: any) => {
    if (typeof value === 'boolean') {
      return (
        <Switch
          checked={editedSettings[key] || false}
          onCheckedChange={(checked) => handleChange(key, checked)}
        />
      )
    } else if (typeof value === 'string') {
      return (
        <Input
          value={editedSettings[key] || ''}
          onChange={(e) => handleChange(key, e.target.value)}
        />
      )
    } else if (typeof value === 'number') {
      return (
        <Input
          type="number"
          value={editedSettings[key] || 0}
          onChange={(e) => handleChange(key, Number(e.target.value))}
        />
      )
    } else {
      // For complex objects, display as JSON
      return (
        <div className="flex flex-col gap-2">
          <textarea
            className="min-h-[100px] p-2 border rounded"
            value={JSON.stringify(editedSettings[key], null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleChange(key, parsed)
              } catch (error) {
                // Don't update if JSON is invalid
              }
            }}
          />
          <p className="text-xs text-muted-foreground">Edit as JSON</p>
        </div>
      )
    }
  }

  // Only render in development mode
  if (!isDev) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dev Settings</DialogTitle>
          <DialogDescription>
            Modify application settings for development and testing purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {isLoading ? (
            <p>Loading settings...</p>
          ) : settings ? (
            Object.entries(settings).map(([key, value]) => (
              <div key={key} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={key} className="text-right col-span-1">
                  {key}
                </Label>
                <div className="col-span-3">{renderSettingControl(key, value)}</div>
              </div>
            ))
          ) : (
            <p>No settings available or not in development mode</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSave}
            disabled={updateSettingMutation.isPending || isLoading}
          >
            {updateSettingMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
