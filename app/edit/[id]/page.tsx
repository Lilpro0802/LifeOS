import { EditEntryForm } from '@/components/edit-entry-form'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  return <EditEntryForm id={resolvedParams.id} />
}
