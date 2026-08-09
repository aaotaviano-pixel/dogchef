export const ORDER_STATUSES = [
  "pending_approval",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus =
  | "not_required"
  | "awaiting_configuration"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled"
  | "failed";
export type PaymentMethod = "pix" | "cash" | "card";
export type DeliveryType = "delivery" | "pickup";
export type PrintStatus = "queued" | "leased" | "printed" | "failed" | "dead";

export type PrintSettings = {
  selectedPrinterId: string;
  printers: { id: string; name: string }[];
};

export type Option = {
  id: string;
  name: string;
  priceCents: number;
  isAvailable: boolean;
};

export type OptionGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  required: boolean;
  options: Option[];
};

export type ProductImage = {
  id: string;
  url: string;
  isMain: boolean;
  sortOrder: number;
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  emoji: string;
  imageUrl: string;
  images: ProductImage[];
  isAvailable: boolean;
  featured?: boolean;
  highlight?: string;
  showcaseOrder: number;
  prepMinutes: number;
  optionGroups: OptionGroup[];
};

export type ProductInput = {
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  prepMinutes: number;
  isAvailable: boolean;
  featured: boolean;
  highlight?: string;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type DeliveryZone = {
  id: string;
  name: string;
  aliases: string[];
  feeCents: number;
  minimumOrderCents: number;
  isAvailable: boolean;
};

export type WorkingHour = {
  weekday: number;
  slot: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

export type Catalog = {
  categories: Category[];
  products: Product[];
  deliveryZones: DeliveryZone[];
  defaultDeliveryFeeCents: number;
  acceptingOrders: boolean;
  pixConfigured: boolean;
  whatsappConfigured: boolean;
  whatsappUrl?: string;
  hoursLabel: string;
  workingHours: WorkingHour[];
};

export type CartLine = {
  key: string;
  productId: string;
  quantity: number;
  optionIds: string[];
  note?: string;
};

export type CustomerAddress = {
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  reference?: string;
};

export type CheckoutInput = {
  clientReference: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: CustomerAddress;
  };
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  items: CartLine[];
};

export type CustomerAccount = {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  profileComplete: boolean;
};

export type PricedLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  optionals: { id: string; name: string; priceCents: number }[];
  note?: string;
  totalCents: number;
};

export type Quote = {
  items: PricedLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  deliveryZone?: string;
};

export type Order = {
  id: string;
  customerId?: string;
  publicCode: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: CustomerAddress;
  };
  quote: Quote;
  payment?: {
    pixCopyPaste?: string;
    qrCodeBase64?: string;
    expiresAt?: string;
    configurationRequired?: boolean;
  };
  printStatus?: PrintStatus;
  events: Array<{
    at: string;
    from?: OrderStatus;
    to: OrderStatus;
    reason?: string;
    actor: "customer" | "admin" | "payment" | "system";
  }>;
};

export type ApiError = { error: string; details?: string[] };
