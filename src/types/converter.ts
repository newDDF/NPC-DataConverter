export type SQLMode = 'insert' | 'update' | 'create';

export type DataFormat = 'json' | 'csv' | 'excel' | 'xml' | 'yaml' | 'md' | 'sql';
export type InputFormatOption = 'auto' | DataFormat;
export type ViewMode = 'code' | 'table';

export interface SampleDataset {
  name: string;
  format: DataFormat;
  data: string;
}

export interface ConversionOptions {
  flattenJSON: boolean;
  csvDelimiter: string;
  indentSize: number;
  xmlRootTag: string;
  xmlItemTag: string;
}
