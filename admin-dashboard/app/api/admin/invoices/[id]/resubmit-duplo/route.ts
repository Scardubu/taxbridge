import { NextResponse } from 'next/server';
import { BackendAPIError, requestBackend } from '@/lib/backend';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const invoiceId = resolvedParams.id;

  try {
    const data = await requestBackend(`/invoices/${invoiceId}/resubmit-duplo`, {
      method: 'POST',
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error resubmitting invoice:', error);
    const status = error instanceof BackendAPIError ? error.status : 500;
    const message = error instanceof BackendAPIError ? error.details || error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to resubmit invoice', message },
      { status }
    );
  }
}
