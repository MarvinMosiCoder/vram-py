import type { Dispatch, SetStateAction } from "react";
import TextInput from "@/components/form/TextInput";
import InputError from "@/components/form/InputError";
import SelectInput from "@/components/form/SelectInput";
import type { SelectOption } from "@/types/modules";
import type { AddMenuForm, FieldErrors, MenuFormValues } from "./types";

const TYPES: SelectOption[] = [
  {
    value: 'Route',
    label: 'Route'
  },
  {
    value: 'URL',
    label: 'URL'
  }
];

const STATUSES: SelectOption[] = [
  {
      value: 1,
      label: 'ACTIVE',
  },
  {
      value: 0,
      label: 'INACTIVE',
  },
]


export const EMPTY_MENU_FORM: AddMenuForm = {
  name: "",
  path: "",
  icon: "",
  roles: [],
  type: "",
  slug: "",
  is_active: "",

};

const MENU_FIELDS: [keyof MenuFormValues, string][] = [
  ["roles", "Roles"],
  ["name", "Menu name"],
  ["path", "Path"],
  ["icon", "Icon class"],
  ["type", "Type"],
  ["slug", "Slug"],
  ["is_active", "Active"],
];

type MenuFormFieldsProps<T extends MenuFormValues> = {
  form: T;
  // The edit draft lives in nullable state, so callers adapt their setter.
  setForm: (update: (current: T) => T) => void;
  errors: FieldErrors;
  setErrors: Dispatch<SetStateAction<FieldErrors>>;
  roles: SelectOption[];
  disabled?: boolean;
  idPrefix: string;
  autoFocusName?: boolean;
};

// Shared by the Add menu form and the edit modal.
export default function MenuFormFields<T extends MenuFormValues>({
  form,
  setForm,
  errors,
  setErrors,
  roles,
  disabled = false,
  idPrefix,
  autoFocusName = false,
}: MenuFormFieldsProps<T>) {
  return MENU_FIELDS.map(([field, label]) => {
    const inputId = `${idPrefix}-${field}`;

    return (
      <div key={field} className="space-y-1.5">
        <label htmlFor={inputId} className="block text-xs text-skin-dim">
          {label}
        </label>

        {field === "roles" ? (
          <SelectInput
            inputId={inputId}
            type="react-select"
            value={roles.filter((option) =>
              (form.roles ?? []).some(
                (role) => String(role.id) === String(option.value)
              )
            )}
            options={roles}
            placeholder="Choose roles"
            onChange={(selected) => {
              setForm((current) => ({
                ...current,
                roles: (selected ?? []).map((option) => ({
                  id: option.value,
                  name: option.label,
                })),
              }));

              setErrors((current) => ({ ...current, roles: "" }));
            }}
            disabled={disabled}
            isMulti
          />
        ) : field === "type" ? (
          <SelectInput
            inputId={inputId}
            type="react-select"
            value={TYPES.find((option) => option.value === form.type) ?? null}
            options={TYPES}
            placeholder="Choose type"
            onChange={(selected) => {
              setForm((current) => ({
                ...current,
                type: typeof selected?.value === "string" ? selected.value : "",
              }));

              setErrors((current) => ({ ...current, type: "" }));
            }}
            disabled={disabled}
          />
        ) : field === "is_active" ? (
          <SelectInput
            inputId={inputId}
            type="react-select"
            value={STATUSES.find((option) => option.value === form.is_active) ?? null}
            options={STATUSES}
            placeholder="Choose Status"
            onChange={(selected) => {
              setForm((current) => ({
                ...current,
                is_active: typeof selected?.value === "number" ? selected.value : "",
              }));

              setErrors((current) => ({ ...current, is_active: "" }));
            }}
            disabled={disabled}
          />
        ) : (
          <TextInput
            id={inputId}
            value={form[field] ?? ""}
            required={field === "name"}
            maxLength={255}
            disabled={disabled}
            autoFocus={autoFocusName && field === "name"}
            aria-invalid={Boolean(errors[field])}
            onChange={(event) => {
              const value = event.target.value;

              setForm((current) => ({
                ...current,
                [field]: value,
              }));

              setErrors((current) => ({ ...current, [field]: "" }));
            }}
          />
        )}

        <InputError message={errors[field]} />
      </div>
    );
  });
}
