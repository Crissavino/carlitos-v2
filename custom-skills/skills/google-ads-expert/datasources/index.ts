/**
 * DataSources Index
 *
 * Factory para obtener el datasource configurado.
 */

import { AdsDataSource } from "./interface.js";
import { AdsScriptSource } from "./ads-script-source.js";
import { GoogleApiSource } from "./google-api-source.js";
import { AdsScriptKeywordsSource, keywordsDataSource } from "./ads-script-keywords-source.js";
import { AdsScriptSearchTermsSource, searchTermsDataSource } from "./ads-script-search-terms-source.js";
import { DataSourceType } from "../types.js";

const sources: Record<DataSourceType, AdsDataSource> = {
  'ads-script': new AdsScriptSource(),
  'google-api': new GoogleApiSource(),
};

export function getDataSource(type: DataSourceType): AdsDataSource {
  const source = sources[type];
  if (!source) {
    throw new Error('Unknown datasource type: ' + type);
  }
  return source;
}

export function getConfiguredDataSource(): AdsDataSource {
  // Por ahora hardcodeado a ads-script
  // TODO: Leer de config cuando implementemos config loader
  const configuredType: DataSourceType = 'ads-script';
  return getDataSource(configuredType);
}

export function getKeywordsDataSource(): AdsScriptKeywordsSource {
  return keywordsDataSource;
}

export function getSearchTermsDataSource(): AdsScriptSearchTermsSource {
  return searchTermsDataSource;
}

export { AdsDataSource, AdsScriptSource, GoogleApiSource, AdsScriptKeywordsSource, keywordsDataSource, AdsScriptSearchTermsSource, searchTermsDataSource };
