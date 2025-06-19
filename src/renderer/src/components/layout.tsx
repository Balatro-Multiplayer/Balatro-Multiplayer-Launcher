import { PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appVersionQueryOptions } from '@renderer/queries'

export function Layout({ children }: PropsWithChildren) {
  const { data: appVersion } = useQuery(appVersionQueryOptions)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-6 ">
        <main className="bg-card rounded-lg p-6">{children}</main>
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Need help? Check the{' '}
            <a href="#" className="text-primary hover:underline">
              documentation
            </a>{' '}
            or{' '}
            <a href="#" className="text-primary hover:underline">
              report an issue
            </a>
            .
          </p>
          {appVersion && <p className="mt-2">v{appVersion}</p>}
        </footer>
      </div>
    </div>
  )
}
