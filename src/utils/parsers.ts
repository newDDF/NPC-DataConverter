import Papa from 'papaparse';
import * as yaml from 'js-yaml';
import * as XLSX from 'xlsx';
import { DataFormat } from '@/types/converter';

export const flattenObject = (
  obj: Record<string, any>, 
  prefix = ''
): Record<string, any> => {
  return Object.keys(obj).reduce((acc: Record<string, any>, k: string) => {
    const pre = prefix.length ? `${prefix}.` : '';
    if (
      typeof obj[k] === 'object' &&
      obj[k] !== null &&
      !Array.isArray(obj[k]) &&
      !(obj[k] instanceof Date)
    ) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else if (Array.isArray(obj[k])) {
      acc[pre + k] = JSON.stringify(obj[k]);
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
};

export const detectFormat = (text: string): DataFormat => {
  if (!text || text.trim() === '') return 'json';
  const trimmed = text.trim();

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Ignore
    }
  }

  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return 'xml';
  }

  if (trimmed.includes(':') && !trimmed.includes(',')) {
    return 'yaml';
  }

  return 'csv';
};

export const xmlToObject = (xmlText: string): any => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  
  if (parseError.length > 0) {
    throw new Error(parseError[0].textContent || 'Invalid XML structure');
  }

  const nodeToObj = (node: Node): any => {
    if (node.nodeType === 3) return node.nodeValue?.trim() || '';
    if (node.nodeType === 1) {
      const element = node as Element;
      let obj: Record<string, any> = {};

      if (element.attributes.length > 0) {
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          obj[`@${attr.name}`] = attr.value;
        }
      }

      if (element.hasChildNodes()) {
        const children = Array.from(element.childNodes).filter(
          (c) => c.nodeType === 1 || (c.nodeType === 3 && c.nodeValue?.trim() !== '')
        );

        if (children.length === 1 && children[0].nodeType === 3) {
          const val = children[0].nodeValue?.trim() || '';
          if (Object.keys(obj).length === 0) return val;
          obj['#text'] = val;
          return obj;
        }

        const childCounts: Record<string, number> = {};
        children.forEach((c) => {
          const name = c.nodeName;
          childCounts[name] = (childCounts[name] || 0) + 1;
        });

        children.forEach((c) => {
          const name = c.nodeName;
          const res = nodeToObj(c);
          if (childCounts[name] > 1) {
            if (!obj[name]) obj[name] = [];
            obj[name].push(res);
          } else {
            obj[name] = res;
          }
        });
      }
      return obj;
    }
    return null;
  };

  let result = nodeToObj(xmlDoc.documentElement);
  if (typeof result === 'object' && result !== null) {
    const keys = Object.keys(result);
    if (keys.length === 1 && Array.isArray(result[keys[0]])) {
      return result[keys[0]];
    }
  }
  return result;
};

export const objectToXML = (
  obj: any, 
  rootTag = 'root', 
  itemTag = 'item', 
  indentSize = 2
): string => {
  const toXML = (v: any, name: string): string => {
    if (v === null || v === undefined) return `<${name}/>`;
    if (Array.isArray(v)) return v.map((item) => toXML(item, itemTag)).join('');
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      const children = keys.map((key) => toXML(v[key], key)).join('');
      return `<${name}>${children}</${name}>`;
    }
    const escapedStr = String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    return `<${name}>${escapedStr}</${name}>`;
  };

  const indent = ' '.repeat(indentSize);
  let rawXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  if (Array.isArray(obj)) {
    rawXml += `<${rootTag}>\n` + obj.map((item: any) => `${indent}${toXML(item, itemTag)}`).join('\n') + `\n</${rootTag}>`;
  } else if (typeof obj === 'object') {
    rawXml += toXML(obj, rootTag);
  } else {
    rawXml += `<${rootTag}>${obj}</${rootTag}>`;
  }
  return rawXml;
};
