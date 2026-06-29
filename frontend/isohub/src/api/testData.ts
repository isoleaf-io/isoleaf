import { api } from "./client";

export interface PersonData {
  name: string;
  cpf: string;
  email: string;
  phone: string | null;
}

export interface CompanyData {
  name: string;
  cnpj: string;
}

export interface PixKeyData {
  keyType: string;
  value: string;
}

export const fetchTestPerson = (locale: string = "pt_BR") =>
  api
    .get<PersonData>("/test-data/person", { params: { locale } })
    .then((r) => r.data);

export const fetchTestCompany = (locale: string = "pt_BR") =>
  api
    .get<CompanyData>("/test-data/company", { params: { locale } })
    .then((r) => r.data);

export const fetchTestPixKey = () =>
  api.get<PixKeyData>("/test-data/pix-key").then((r) => r.data);

export const fetchTestCity = (locale: string = "pt_BR") =>
  api
    .get<string>("/test-data/city", { params: { locale } })
    .then((r) => r.data);
