// apps/pdf-service/src/pdf/pdf.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { NiveauConfidentialite } from '@sigea/shared-types';
import { renderManifesteHtml, ManifesteRenderData } from './manifeste-template';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);

  // Un SEUL navigateur, réutilisé et relancé au besoin. Lancer Chromium à
  // chaque requête ajoute ~300-800 ms et sature la RAM sous charge.
  private browser?: puppeteer.Browser;
  private launching?: Promise<puppeteer.Browser>;

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser?.connected) return this.browser;
    // Évite deux lancements concurrents (thundering herd au démarrage).
    if (!this.launching) {
      this.launching = puppeteer
        .launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        })
        .then((b) => {
          this.browser = b;
          this.launching = undefined;
          return b;
        })
        .catch((e) => {
          this.launching = undefined;
          throw e;
        });
    }
    return this.launching;
  }

  async generateManifeste(
    data: ManifesteRenderData,
    niveau: NiveauConfidentialite,
  ): Promise<Buffer> {
    const html = renderManifesteHtml(data, this.getWatermark(niveau));
    const pdf = await this.htmlToPdf(html);
    this.logger.log(`PDF manifeste ${data.id} généré (niveau=${niveau}, ${pdf.length} o)`);
    return pdf;
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // 'load' suffit : le HTML est autonome (SVG inline, aucune ressource
      // réseau). 'networkidle0' ferait attendre un timeout inutile.
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      // La page est TOUJOURS fermée, même si pdf() échoue : sinon fuite
      // d'onglets jusqu'à épuisement mémoire.
      await page.close().catch(() => undefined);
    }
  }

  private getWatermark(niveau: NiveauConfidentialite): string {
    const map: Record<NiveauConfidentialite, string> = {
      [NiveauConfidentialite.NON_CLASSIFIE]: '',
      [NiveauConfidentialite.DIFFUSION_RESTREINTE]: 'DIFFUSION RESTREINTE',
      [NiveauConfidentialite.CONFIDENTIEL_DEFENSE]: 'CONFIDENTIEL DÉFENSE',
      [NiveauConfidentialite.SENSIBLE_CEMAA]: 'SENSIBLE CEMAA',
    };
    return map[niveau] ?? '';
  }
}