import { authHeaders } from './api';
import toast from 'react-hot-toast';

export interface CreateCheckoutSessionParams {
  planId: string;
  businessId?: string;
  businessName?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Creates a Stripe Checkout Session on the server and returns the redirect URL
 */
export async function createStripeCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to initialize Stripe Checkout session.');
    }

    return { url: data.url };
  } catch (err: any) {
    console.error('[Stripe Client Error]:', err);
    return { error: err.message || 'Unable to connect to Stripe checkout.' };
  }
}

/**
 * Redirects the business administrator directly to Stripe's hosted Checkout page
 */
export async function redirectToStripeCheckout(params: CreateCheckoutSessionParams): Promise<void> {
  const toastId = toast.loading('Opening secure Stripe Checkout...');
  const result = await createStripeCheckoutSession(params);
  if (result.url) {
    toast.dismiss(toastId);
    window.location.href = result.url;
  } else {
    toast.error(result.error || 'Checkout initiation failed.', { id: toastId });
  }
}
