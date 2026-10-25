// Shapes of the database rows the app reads. Money is whole pence.

export type StaffRole = "owner" | "manager" | "bar";

export type StaffProfile = {
  user_id: string;
  staff_code: string;
  display_name: string;
  role: StaffRole;
  is_device: boolean;
  active: boolean;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  visible: boolean;
};

export type Variant = {
  id: string;
  drink_id: string;
  label: string;
  price_pence: number;
  available: boolean;
  sort_order: number;
  archived_at: string | null;
};

export type Drink = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  abv: number | null;
  contains_alcohol: boolean;
  is_welsh: boolean;
  offers_no_ice: boolean;
  allergens: string[];
  vat_rate: number;
  available: boolean;
  sort_order: number;
  archived_at: string | null;
  drink_variants: Variant[];
  drink_modifier_groups: { group_id: string }[];
};

export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  sort_order: number;
  modifier_options: { id: string; label: string; price_pence: number; archived_at: string | null }[];
};

export type VenueTable = {
  id: string;
  label: string;
  area_id: string | null;
  active: boolean;
  sort_order: number;
};

export type VenueSettings = {
  id: number;
  venue_name: string;
  ordering_paused: boolean;
  pause_message: string;
  wait_amber_minutes: number;
  wait_red_minutes: number;
  vat_registered: boolean;
  vat_number: string | null;
  default_vat_rate: number;
  age_declaration_text: string;
  bar_staff_can_toggle_stock: boolean;
  minimum_order_pence: number;
  receipt_sender_name: string;
  receipt_reply_to: string | null;
  email_retention_days: number;
  customer_menu_live: boolean;
  test_orders_until: string | null;
};

export type OpeningHours = {
  weekday: number; // 1 = Monday ... 7 = Sunday
  opens_at: string; // "HH:MM:SS"
  closes_at: string;
  closed: boolean;
};

export const UK_ALLERGENS = [
  "Celery",
  "Cereals containing gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Lupin",
  "Milk",
  "Molluscs",
  "Mustard",
  "Tree nuts",
  "Peanuts",
  "Sesame",
  "Soya",
  "Sulphites",
] as const;

export type FulfilmentStatus = "new" | "preparing" | "ready" | "delivered" | "cancelled";

export type BarOrderItem = {
  id: string;
  drink_name: string;
  variant_label: string;
  quantity: number;
  no_ice: boolean;
  ticked: boolean;
  sort_order: number;
  order_item_options: { option_label: string; group_name: string }[];
  drinks: { contains_alcohol: boolean } | null;
};

export type BarOrder = {
  id: string;
  order_number: number;
  table_label: string;
  total_pence: number;
  payment_method_label: string | null;
  paid_at: string;
  fulfilment_status: FulfilmentStatus;
  delivered_at: string | null;
  problem_reason: string | null;
  version: number;
  order_items: BarOrderItem[];
};
