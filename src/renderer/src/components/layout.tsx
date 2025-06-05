import { PropsWithChildren } from 'react'

export function Layout({ children }: PropsWithChildren) {
  return <div className={'container mx-auto p-6'}>{children}</div>
}
