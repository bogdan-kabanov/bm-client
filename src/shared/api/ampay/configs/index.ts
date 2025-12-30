/**
 * Экспорт всех конфигураций методов AmPay по валютам
 */
import { cnyMethods } from './cny';
import { idrMethods } from './idr';
import { inrMethods } from './inr';
import { aznMethods } from './azn';
import { eurMethods } from './eur';
import { vndMethods } from './vnd';
import { tryMethods } from './try';
import { copMethods } from './cop';
import { arsMethods } from './ars';
import { vesMethods } from './ves';
import { brlMethods } from './brl';
import { bdtMethods } from './bdt';
import { pkrMethods } from './pkr';
import { kztMethods } from './kzt';
import { uzsMethods } from './uzs';
import { tjsMethods } from './tjs';
import { kgsMethods } from './kgs';
import { mxnMethods } from './mxn';
import { clpMethods } from './clp';
import { penMethods } from './pen';
import { myrMethods } from './myr';
import { phpMethods } from './php';
import { aedMethods } from './aed';
import { cdfMethods } from './cdf';
import type { CreateAmpayMethodConfigRequest } from '../types';

/**
 * Все методы AmPay, сгруппированные по валютам
 */
export const allAmpayMethods: Record<string, CreateAmpayMethodConfigRequest[]> = {
    CNY: cnyMethods,
    IDR: idrMethods,
    INR: inrMethods,
    AZN: aznMethods,
    EUR: eurMethods,
    VND: vndMethods,
    TRY: tryMethods,
    COP: copMethods,
    ARS: arsMethods,
    VES: vesMethods,
    BRL: brlMethods,
    BDT: bdtMethods,
    PKR: pkrMethods,
    KZT: kztMethods,
    UZS: uzsMethods,
    TJS: tjsMethods,
    KGS: kgsMethods,
    MXN: mxnMethods,
    CLP: clpMethods,
    PEN: penMethods,
    MYR: myrMethods,
    PHP: phpMethods,
    AED: aedMethods,
    CDF: cdfMethods
};

/**
 * Получить все методы для всех валют
 */
export const getAllMethods = (): CreateAmpayMethodConfigRequest[] => {
    return Object.values(allAmpayMethods).flat();
};

/**
 * Получить методы для конкретной валюты
 */
export const getMethodsByCurrency = (currency: string): CreateAmpayMethodConfigRequest[] => {
    return allAmpayMethods[currency.toUpperCase()] || [];
};

/**
 * Получить методы по направлению (IN/OUT)
 */
export const getMethodsByDirection = (direction: 'IN' | 'OUT'): CreateAmpayMethodConfigRequest[] => {
    return getAllMethods().filter(method => method.direction === direction);
};

/**
 * Получить методы по валюте и направлению
 */
export const getMethodsByCurrencyAndDirection = (
    currency: string,
    direction: 'IN' | 'OUT'
): CreateAmpayMethodConfigRequest[] => {
    return getMethodsByCurrency(currency).filter(method => method.direction === direction);
};

// Экспорт отдельных конфигураций
export {
    cnyMethods,
    idrMethods,
    inrMethods,
    aznMethods,
    eurMethods,
    vndMethods,
    tryMethods,
    copMethods,
    arsMethods,
    vesMethods,
    brlMethods,
    bdtMethods,
    pkrMethods,
    kztMethods,
    uzsMethods,
    tjsMethods,
    kgsMethods,
    mxnMethods,
    clpMethods,
    penMethods,
    myrMethods,
    phpMethods,
    aedMethods,
    cdfMethods
};

// Экспорт списка методов
export * from './methodsList';

