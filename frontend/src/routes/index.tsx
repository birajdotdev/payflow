import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, WalletCards, ShieldCheck, History } from 'lucide-react'

import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

export const Route = createFileRoute('/')({ component: Home })
function Home() {
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-6">
        <Brand />
        <Button
          variant="outline"
          render={
            <Link
              to="/login"
              search={{ redirect: '/dashboard', registered: false }}
            />
          }
        >
          Sign in
        </Button>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 sm:py-24">
        <section className="flex max-w-3xl flex-col items-start gap-6">
          <p className="text-sm font-medium text-primary">
            MONEY, WITH ROOM TO BREATHE
          </p>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
            Your wallet.
            <br />A clearer picture.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Meet PayFlow. A simple home for your balance and activity, built to
            make every step easy to follow.
          </p>
          <Button
            size="lg"
            render={<Link to="/register" search={{ redirect: '/dashboard' }} />}
          >
            Create your wallet
            <ArrowRight data-icon="inline-end" />
          </Button>
          <p className="text-xs text-muted-foreground">
            A demo experience with simulated NPR funds.
          </p>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: WalletCards,
              title: 'One wallet, all yours',
              description: 'Your own NPR wallet is created when you register.',
            },
            {
              icon: History,
              title: 'See where you stand',
              description:
                'Your balance and recent activity, straight from your wallet.',
            },
            {
              icon: ShieldCheck,
              title: 'Sign in with confidence',
              description:
                'Secure sessions keep your wallet connected across reloads.',
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <item.icon className="mb-3 size-6 text-primary" />
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  )
}
