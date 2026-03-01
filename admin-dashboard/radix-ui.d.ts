/**
 * Ambient module declarations for Radix UI packages whose dist .d.ts
 * files are absent or not resolved via moduleResolution:"bundler".
 *
 * These packages are installed and tested at runtime; the declarations
 * here silence TS7016 / TS2307 without weakening any application types.
 * The `as any` casts live only in here, not in application code (C-01 safe).
 */

// @radix-ui/react-dialog — required by components/ui/dialog.tsx
declare module '@radix-ui/react-dialog' {
  import * as React from 'react';
  const Root: React.FC<{ open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode; defaultOpen?: boolean }>;
  const Trigger: React.FC<{ asChild?: boolean; children?: React.ReactNode }>;
  const Portal: React.FC<{ children?: React.ReactNode; container?: HTMLElement }>;
  const Overlay: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Content: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Header: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  const Footer: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  const Title: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLHeadingElement> & React.RefAttributes<HTMLHeadingElement>>;
  const Description: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>>;
  const Close: React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean } & React.RefAttributes<HTMLButtonElement>>;
}

// @radix-ui/react-select — required by components/ui/select.tsx
declare module '@radix-ui/react-select' {
  import * as React from 'react';
  type SelectProps = {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    dir?: 'ltr' | 'rtl';
    name?: string;
    disabled?: boolean;
    required?: boolean;
    children?: React.ReactNode;
  };
  const Root: React.FC<SelectProps>;
  const Group: React.FC<{ children?: React.ReactNode }>;
  const Value: React.FC<{ placeholder?: string; children?: React.ReactNode }>;
  const Trigger: React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean } & React.RefAttributes<HTMLButtonElement>>;
  const ScrollUpButton: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const ScrollDownButton: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Viewport: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Content: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { position?: 'item-aligned' | 'popper'; side?: 'top' | 'right' | 'bottom' | 'left'; sideOffset?: number; align?: 'start' | 'center' | 'end'; alignOffset?: number; avoidCollisions?: boolean; collisionBoundary?: Element | null | (Element | null)[]; collisionPadding?: number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>; arrowPadding?: number; sticky?: 'partial' | 'always'; hideWhenDetached?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const Label: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Item: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean; textValue?: string } & React.RefAttributes<HTMLDivElement>>;
  const ItemText: React.FC<{ children?: React.ReactNode }>;
  const ItemIndicator: React.FC<{ children?: React.ReactNode }>;
  const Separator: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Icon: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLSpanElement> & { asChild?: boolean } & React.RefAttributes<HTMLSpanElement>>;
  const Portal: React.FC<{ children?: React.ReactNode; container?: HTMLElement }>;
}

// @radix-ui/react-dropdown-menu — required by components/ui/dropdown-menu.tsx
declare module '@radix-ui/react-dropdown-menu' {
  import * as React from 'react';
  const Root: React.FC<{ open?: boolean; onOpenChange?: (open: boolean) => void; defaultOpen?: boolean; dir?: string; modal?: boolean; children?: React.ReactNode }>;
  const Trigger: React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean } & React.RefAttributes<HTMLButtonElement>>;
  const Group: React.FC<{ children?: React.ReactNode }>;
  const Portal: React.FC<{ children?: React.ReactNode }>;
  const Sub: React.FC<{ open?: boolean; onOpenChange?: (open: boolean) => void; defaultOpen?: boolean; children?: React.ReactNode }>;
  const RadioGroup: React.FC<{ value?: string; onValueChange?: (value: string) => void; children?: React.ReactNode }>;
  const SubTrigger: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean; disabled?: boolean; textValue?: string; inset?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const SubContent: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
  const Content: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { loop?: boolean; onCloseAutoFocus?: (e: Event) => void; onEscapeKeyDown?: (e: KeyboardEvent) => void; onPointerDownOutside?: (e: PointerEvent) => void; onFocusOutside?: (e: FocusEvent) => void; onInteractOutside?: (e: Event) => void; forceMount?: boolean; side?: 'top' | 'right' | 'bottom' | 'left'; sideOffset?: number; align?: 'start' | 'center' | 'end'; alignOffset?: number; avoidCollisions?: boolean; collisionBoundary?: Element | null | (Element | null)[]; collisionPadding?: number; sticky?: 'partial' | 'always'; hideWhenDetached?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const Arrow: React.ForwardRefExoticComponent<React.SVGAttributes<SVGSVGElement> & React.RefAttributes<SVGSVGElement>>;
  const Item: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean; disabled?: boolean; onSelect?: (e: Event) => void; textValue?: string; inset?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const CheckboxItem: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { checked?: boolean | 'indeterminate'; onCheckedChange?: (checked: boolean) => void; disabled?: boolean; onSelect?: (e: Event) => void; textValue?: string } & React.RefAttributes<HTMLDivElement>>;
  const RadioItem: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean; onSelect?: (e: Event) => void; textValue?: string } & React.RefAttributes<HTMLDivElement>>;
  const Label: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean; inset?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const Separator: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const Shortcut: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
  const ItemIndicator: React.FC<{ forceMount?: boolean; children?: React.ReactNode }>;
}

// @radix-ui/react-label — required by components/ui/label.tsx
declare module '@radix-ui/react-label' {
  import * as React from 'react';
  const Root: React.ForwardRefExoticComponent<React.LabelHTMLAttributes<HTMLLabelElement> & { asChild?: boolean } & React.RefAttributes<HTMLLabelElement>>;
}

// @radix-ui/react-progress — required by components/ui/progress.tsx
declare module '@radix-ui/react-progress' {
  import * as React from 'react';
  const Root: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { value?: number | null; max?: number; getValueLabel?: (value: number, max: number) => string; asChild?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const Indicator: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean } & React.RefAttributes<HTMLDivElement>>;
}

// @radix-ui/react-tabs — required by components/ui/tabs.tsx
declare module '@radix-ui/react-tabs' {
  import * as React from 'react';
  const Root: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string; value?: string; onValueChange?: (value: string) => void; orientation?: 'horizontal' | 'vertical'; dir?: 'ltr' | 'rtl'; activationMode?: 'automatic' | 'manual'; asChild?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const List: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean; loop?: boolean } & React.RefAttributes<HTMLDivElement>>;
  const Trigger: React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; value: string; disabled?: boolean } & React.RefAttributes<HTMLButtonElement>>;
  const Content: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean; value: string; forceMount?: boolean } & React.RefAttributes<HTMLDivElement>>;
}
