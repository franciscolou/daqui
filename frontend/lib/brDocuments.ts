// Máscara e validação de CPF/CNPJ no app — espelha a validação do ads-backend
// (core/br_documents.py) pra dar feedback imediato antes de mandar pro servidor.
import { AdvertiserType } from './adsApi';

export function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '');
}

// CPF: 000.000.000-00 · CNPJ: 00.000.000/0000-00 (formata parcialmente
// enquanto o usuário digita).
export function maskDocument(type: AdvertiserType, value: string): string {
  const d = onlyDigits(value);
  if (type === 'individual') {
    return d
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (slice: number, factor: number) => {
    let total = 0;
    for (let i = 0; i < slice; i++) total += parseInt(cpf[i], 10) * (factor - i);
    const rem = (total * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  return digit(9, 10) === parseInt(cpf[9], 10) && digit(10, 11) === parseInt(cpf[10], 10);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (slice: number, weights: number[]) => {
    let total = 0;
    for (let i = 0; i < slice; i++) total += parseInt(cnpj[i], 10) * weights[i];
    const rem = total % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return digit(12, w1) === parseInt(cnpj[12], 10) && digit(13, w2) === parseInt(cnpj[13], 10);
}

export function isValidDocument(type: AdvertiserType, value: string): boolean {
  return type === 'individual' ? isValidCpf(value) : isValidCnpj(value);
}
