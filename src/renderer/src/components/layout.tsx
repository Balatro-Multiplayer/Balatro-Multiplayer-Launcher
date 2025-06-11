import { PropsWithChildren } from 'react'
import { ThemeToggle } from '@renderer/components/ui/theme-toggle'

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-6 max-w-3xl">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-primary">Balatro Multiplayer Helper</h1>
            <p className="text-muted-foreground mt-2">Manage your multiplayer mod versions with ease</p>
          </div>
          <ThemeToggle />
        </header>
        <main className="bg-card rounded-lg shadow-sm p-6 border border-border">
          {children}
        </main>
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>Need help? Check the <a href="#" className="text-primary hover:underline">documentation</a> or <a href="#" className="text-primary hover:underline">report an issue</a>.</p>
        </footer>
      </div>
    </div>
  )
}
