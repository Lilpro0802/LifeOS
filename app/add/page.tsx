import { Sidebar } from '@/components/sidebar'
import { AddEntryForm } from '@/components/add-entry-form'

export default function AddEntryPage() {
  return (
    <div className="flex min-h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 w-full overflow-x-hidden">
        <AddEntryForm />
      </main>
    </div>
  )
}
