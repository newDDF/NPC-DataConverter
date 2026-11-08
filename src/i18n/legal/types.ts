export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  effectiveDate: string;
  introduction: string;
  sections: LegalSection[];
  footerPrefix: string;
  linkLabel: string;
  footerSuffix: string;
}

export interface LegalDocuments {
  privacy: LegalDocument;
  terms: LegalDocument;
}
