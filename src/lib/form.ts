export function requiredString(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

export function optionalString(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() || null;
}

export function requiredPositiveNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be greater than zero`);
  }

  return value;
}

export function requiredNonNegativeNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be zero or greater`);
  }

  return value;
}

export function money(value: number) {
  return value.toFixed(2);
}

export function quantity(value: number) {
  return value.toFixed(3);
}

