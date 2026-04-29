import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { CemaaCryptoService } from '@sigea/shared-crypto';
import { NiveauConfidentialite } from '@sigea/shared-types';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private readonly crypto: CemaaCryptoService) {}

  async generateManifeste(manifesteData: unknown, niveau: NiveauConfidentialite): Promise<Buffer> {
    const html = await this.renderTemplate(manifesteData, niveau);
    const pdfBuffer = await this.htmlToPdf(html);
    this.logger.log(`PDF généré : niveau=${niveau}`);
    return pdfBuffer;
  }

  private async renderTemplate(data: unknown, niveau: NiveauConfidentialite): Promise<string> {
    // Templates HTML dans apps/pdf-service/src/templates/
    const watermark = this.getWatermark(niveau);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{font-family:Arial,sans-serif;} .watermark{position:fixed;opacity:0.15;font-size:72px;transform:rotate(-45deg);top:40%;left:10%;color:red;}</style>
      </head><body>
      <div class="watermark">${watermark}</div>
      <pre>${JSON.stringify(data, null, 2)}</pre>
      </body></html>`;
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdf);
  }

  private getWatermark(niveau: NiveauConfidentialite): string {
    const map: Record<NiveauConfidentialite, string> = {
      [NiveauConfidentialite.NON_CLASSIFIE]: '',
      [NiveauConfidentialite.DIFFUSION_RESTREINTE]: 'DIFFUSION RESTREINTE',
      [NiveauConfidentialite.CONFIDENTIEL_DEFENSE]: 'CONFIDENTIEL DÉFENSE',
      [NiveauConfidentialite.SENSIBLE_CEMAA]: 'SENSIBLE CEMAA — CONFIDENTIEL DÉFENSE',
    };
    return map[niveau];
  }
}
