import { EditCardForm } from '@/components/edit-card-form'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default async function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  return <EditCardForm id={resolvedParams.id} />
}
