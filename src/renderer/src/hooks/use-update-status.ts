import { useQuery, useQueryClient } from '@tanstack/react-query'
import { updateStatusQueryOptions } from '@renderer/queries'
import { useEffect } from 'react'
import { toast } from 'sonner'

interface UpdateStatus {
  status: string
  version?: string
  progress?: {
    bytesPerSecond: number
    percent: number
    transferred: number
    total: number
  }
  error?: string
  releaseNotes?: string
}

export function useUpdateStatus() {
  const queryClient = useQueryClient()

  // Set up initial query
  const query = useQuery({
    ...updateStatusQueryOptions,
    // Don't refetch on window focus or interval
    refetchOnWindowFocus: false,
    refetchInterval: false
  })

  // Set up the update status listener
  useEffect(() => {
    const removeListener = window.api.onUpdateStatus((status: UpdateStatus) => {
      // Update the query data
      queryClient.setQueryData(updateStatusQueryOptions.queryKey, status)

      // Show toast notifications for different update statuses
      switch (status.status) {
        case 'update-available':
          toast.info(`Update available: v${status.version}`)
          break
        case 'update-downloaded':
          toast.success(`Update downloaded: v${status.version}. Restart to install.`)
          break
        case 'error':
          toast.error(`Update error: ${status.error}`)
          break
      }
    })

    // Check for updates when the hook is first used
    window.api.checkForUpdates().catch((error) => {
      console.error('Error checking for updates:', error)
      toast.error('Failed to check for updates')
    })

    // Clean up the listener when the component unmounts
    return () => {
      removeListener()
    }
  }, [queryClient])

  // Function to manually check for updates
  const checkForUpdates = async () => {
    try {
      await window.api.checkForUpdates()
    } catch (error) {
      console.error('Error checking for updates:', error)
      toast.error('Failed to check for updates')
    }
  }

  // Function to install the update
  const installUpdate = () => {
    try {
      window.api.installUpdate()
    } catch (error) {
      console.error('Error installing update:', error)
      toast.error('Failed to install update')
    }
  }

  return {
    ...query,
    checkForUpdates,
    installUpdate
  }
}
