export type Matter = {
  id: string;
  reference: string;
  type: string;
  status: string;
  property_address?: string | null;
  created_at: string;
};

export type MatterDashboard = {
  matter: Matter;
  onboarding: {
    percent: number;
    missing: string[];
    is_complete: boolean;
  };
  documents: Array<{
    id: string;
    category: string;
    original_filename: string;
    download_url: string;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    amount_pence: number;
    currency: string;
    status: string;
    stripe_payment_intent_id?: string | null;
    created_at: string;
  }>;
  tasks: Array<{
    id: string;
    template_key: string;
    title: string;
    due_date?: string | null;
    status: string;
    notes?: string | null;
  }>;
};
