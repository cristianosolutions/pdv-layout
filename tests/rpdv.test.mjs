import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRPdv, serializeRPdv, encodeRPdv } from '../src/experimental/rpdv/rpdv.ts';
const source = 'TForm¨0¨0¨768¨1366¨1366¨1¨0¨1¨1\r\nTPainel¨Painel0¨FPrinc¨1¨¨0¨0¨768¨1366¨0¨0¨0¨0¨0¨0¨0¨16777215¨0^0^0^0^¨tela_1366_768.png¨0¨0\r\nTEtiq¨Etiq1¨Painel0¨21¨CÓDIGO¨112¨94¨41¨550¨0¨1¨0¨0¨1¨536870911¨0^-27^20^Arial^1010¨¨\r\nTFita¨opaque¨unchanged\r\nTMenu¨unknown¨1¨2';
test('preserves all bytes for an unchanged legacy project', () => {
 const bytes = encodeRPdv(source, 'windows-1252');
 const doc = parseRPdv(bytes);
 assert.equal(doc.background, 'tela_1366_768.png');
 assert.equal(doc.elements[0].textAlign, 'right');
 assert.deepEqual(serializeRPdv(doc, doc.elements), bytes);
});
test('changes only edited properties, preserving function and unknown records', () => {
 const doc = parseRPdv(encodeRPdv(source, 'windows-1252'));
 const edited = doc.elements.map(el => ({...el, x: 200, fill: '#ff0000', text: 'Entrada', fontWeight: 'normal'}));
 const saved = new TextDecoder('windows-1252').decode(serializeRPdv(doc, edited));
 assert.ok(saved.includes('TEtiq¨Etiq1¨Painel0¨21¨Entrada¨200¨94¨41¨550'));
 assert.ok(saved.includes('255^-27^20^Arial^0010'));
 assert.ok(saved.endsWith('TFita¨opaque¨unchanged\r\nTMenu¨unknown¨1¨2'));
 assert.equal(parseRPdv(serializeRPdv(doc, edited)).elements[0].fill, '#ff0000');
});
test('preserves UTF-8 BOM and prevents invalid separators or unsupported characters', () => {
 const bytes = encodeRPdv(source, 'utf-8', true), doc = parseRPdv(bytes);
 assert.deepEqual(serializeRPdv(doc, doc.elements), bytes);
 assert.throws(() => serializeRPdv(doc, [{...doc.elements[0], text: 'invalid¨value'}]));
 assert.throws(() => encodeRPdv('😀', 'windows-1252'));
});
if (process.env.RPDV_SAMPLE) test('round-trips actual supplied TXT without changing any byte', () => {
 const bytes = readFileSync(process.env.RPDV_SAMPLE);
 const doc = parseRPdv(bytes);
 assert.equal(doc.elements.length, 31);
 assert.deepEqual(Buffer.from(serializeRPdv(doc, doc.elements)), bytes);
});
