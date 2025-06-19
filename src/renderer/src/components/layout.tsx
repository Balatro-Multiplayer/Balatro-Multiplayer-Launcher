import { PropsWithChildren } from 'react'

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-6 ">
        <main className="bg-card rounded-lg shadow-sm p-6 border border-border">{children}</main>
        {/*<footer className="mt-8 text-center text-sm text-muted-foreground">*/}
        {/*  <p>*/}
        {/*    Need help? Check the{' '}*/}
        {/*    <a href="#" className="text-primary hover:underline">*/}
        {/*      documentation*/}
        {/*    </a>{' '}*/}
        {/*    or{' '}*/}
        {/*    <a href="#" className="text-primary hover:underline">*/}
        {/*      report an issue*/}
        {/*    </a>*/}
        {/*    .*/}
        {/*  </p>*/}
        {/*</footer>*/}
      </div>
    </div>
  )
}
