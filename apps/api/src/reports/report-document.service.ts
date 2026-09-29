import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import JSZip from 'jszip';

type ReportData = Record<string, any>;
type ExportBlock =
  | { kind: 'title' | 'heading1' | 'heading2'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string };

@Injectable()
export class ReportDocumentService {
  private blocks(report: ReportData, narrative?: string): ExportBlock[] {
    const blocks: ExportBlock[] = [];
    const networkLabel = report.network?.name || 'Conjunto de las cuatro redes';
    const period = report.period
      ? `${this.formatDate(report.period.from)} – ${this.formatDate(report.period.to)}`
      : 'Curso completo';

    blocks.push(
      { kind: 'title', text: 'CÍCLOPE FP · Memoria de Redes' },
      { kind: 'paragraph', text: `${report.center?.name || 'Centro'} · ${report.academicYear?.name || ''}` },
      { kind: 'paragraph', text: `${networkLabel} · Periodo: ${period}` },
      { kind: 'heading1', text: 'Resumen ejecutivo' },
      { kind: 'paragraph', text: `Actuaciones validadas: ${report.totals?.validated ?? 0}.` },
      { kind: 'paragraph', text: `Participaciones de alumnado declaradas: ${report.totals?.participants ?? 0}.` },
      { kind: 'paragraph', text: `Horas registradas: ${report.totals?.totalHours ?? 0}.` },
      { kind: 'paragraph', text: `Evidencias: ${report.totals?.evidence ?? 0}.` },
      { kind: 'paragraph', text: `Cobertura documental: ${report.totals?.evidenceCoveragePercent ?? 0}%.` },
    );

    if (report.transversalOverview) {
      blocks.push(
        { kind: 'heading1', text: 'Visión transversal de las redes' },
        { kind: 'paragraph', text: `Redes con actividad validada: ${report.transversalOverview.networksWithActivity} de ${report.transversalOverview.networkCount}.` },
        { kind: 'paragraph', text: `Planes configurados: ${report.transversalOverview.plansConfigured} de ${report.transversalOverview.networkCount}.` },
        { kind: 'paragraph', text: `Avance medio de planes medibles: ${report.transversalOverview.averagePlanProgressPercent ?? '—'}%.` },
        { kind: 'paragraph', text: `Redes con tareas vencidas: ${report.transversalOverview.networksWithOverdueTasks}.` },
      );
    }

    if (Array.isArray(report.alerts) && report.alerts.length) {
      blocks.push({ kind: 'heading1', text: 'Alertas y seguimiento' });
      for (const alert of report.alerts) {
        blocks.push({ kind: 'bullet', text: `${alert.title}: ${alert.detail}` });
      }
    }

    if (Array.isArray(report.planProgress) && report.planProgress.length) {
      blocks.push({ kind: 'heading1', text: 'Seguimiento de planes anuales' });
      for (const plan of report.planProgress) {
        blocks.push(
          { kind: 'heading2', text: plan.network?.name || plan.title || 'Plan' },
          { kind: 'paragraph', text: `Avance medio: ${plan.averageProgressPercent ?? '—'}%. Objetivos medibles: ${plan.measurableObjectives ?? 0}.` },
          { kind: 'paragraph', text: `Tareas: ${plan.taskSummary?.done ?? 0} completadas, ${plan.taskSummary?.pending ?? 0} pendientes y ${plan.taskSummary?.overdue ?? 0} vencidas.` },
        );
      }
    }

    if (Array.isArray(report.byNetwork) && report.byNetwork.length) {
      blocks.push({ kind: 'heading1', text: 'Actividad por red' });
      for (const row of report.byNetwork) {
        blocks.push({
          kind: 'bullet',
          text: `${row.name}: ${row.actions} actuaciones, ${row.participants} participaciones y ${row.evidence} evidencias.`,
        });
      }
    }

    if (Array.isArray(report.byFamily) && report.byFamily.length) {
      blocks.push({ kind: 'heading1', text: 'Actividad por familia profesional' });
      for (const row of report.byFamily) {
        blocks.push({
          kind: 'bullet',
          text: `${row.name}: ${row.actions} actuaciones y ${row.participants} participaciones.`,
        });
      }
    }

    if (narrative?.trim()) {
      blocks.push({ kind: 'heading1', text: 'Narrativa de la memoria' });
      for (const paragraph of narrative.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)) {
        blocks.push({ kind: 'paragraph', text: paragraph });
      }
    }

    blocks.push(
      { kind: 'heading1', text: 'Notas metodológicas' },
      {
        kind: 'paragraph',
        text: 'Las cifras se generan a partir de actuaciones validadas en CÍCLOPE. Las participaciones declaradas no equivalen necesariamente a personas únicas cuando un mismo alumno participa en varias actuaciones.',
      },
      {
        kind: 'paragraph',
        text: `Documento generado el ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: process.env.APP_TIME_ZONE || 'Atlantic/Canary' }).format(new Date())}.`,
      },
    );

    return blocks;
  }

  async docx(report: ReportData, narrative?: string) {
    const children: Array<Paragraph | Table> = [];
    for (const block of this.blocks(report, narrative)) {
      if (block.kind === 'title') {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 260 },
          children: [new TextRun({ text: block.text, bold: true, size: 34, color: '123F6D' })],
        }));
      } else if (block.kind === 'heading1') {
        children.push(new Paragraph({
          text: block.text,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 120 },
        }));
      } else if (block.kind === 'heading2') {
        children.push(new Paragraph({
          text: block.text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 80 },
        }));
      } else if (block.kind === 'bullet') {
        children.push(new Paragraph({
          text: block.text,
          bullet: { level: 0 },
          spacing: { after: 70 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: block.text, size: 22 })],
          spacing: { after: 110 },
        }));
      }
    }

    if (Array.isArray(report.transversalOverview?.rows) && report.transversalOverview.rows.length) {
      children.splice(
        Math.min(10, children.length),
        0,
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ['Red', 'Actuaciones', 'Participaciones', 'Evidencias', 'Avance plan', 'Vencidas']
                .map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })),
            }),
            ...report.transversalOverview.rows.map((row: any) => new TableRow({
              children: [
                row.name,
                String(row.actions ?? 0),
                String(row.participants ?? 0),
                String(row.evidence ?? 0),
                row.planProgressPercent === null ? '—' : `${row.planProgressPercent}%`,
                String(row.tasksOverdue ?? 0),
              ].map((text) => new TableCell({ children: [new Paragraph(String(text))] })),
            })),
          ],
        }),
      );
    }

    const document = new Document({
      creator: 'CÍCLOPE FP',
      title: 'Memoria de Redes de Enseñanzas Profesionales',
      description: 'Memoria generada por CÍCLOPE FP a partir de datos validados.',
      sections: [{
        properties: {},
        children,
      }],
    });

    return Packer.toBuffer(document);
  }

  async odt(report: ReportData, narrative?: string) {
    const zip = new JSZip();
    const mime = 'application/vnd.oasis.opendocument.text';
    zip.file('mimetype', mime, { compression: 'STORE' });

    const blockXml = this.blocks(report, narrative).map((block) => {
      const text = this.escapeXml(block.text);
      if (block.kind === 'title') return `<text:h text:outline-level="1" text:style-name="Title">${text}</text:h>`;
      if (block.kind === 'heading1') return `<text:h text:outline-level="1" text:style-name="Heading_20_1">${text}</text:h>`;
      if (block.kind === 'heading2') return `<text:h text:outline-level="2" text:style-name="Heading_20_2">${text}</text:h>`;
      if (block.kind === 'bullet') {
        return `<text:list text:style-name="L1"><text:list-item><text:p text:style-name="Standard">${text}</text:p></text:list-item></text:list>`;
      }
      return `<text:p text:style-name="Standard">${text}</text:p>`;
    }).join('\n');

    const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
 xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 office:version="1.3">
 <office:automatic-styles/>
 <office:body>
  <office:text>
   ${blockXml}
  </office:text>
 </office:body>
</office:document-content>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
 xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 office:version="1.3">
 <office:styles>
  <style:style style:name="Standard" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.12in"/><style:text-properties fo:font-size="11pt"/></style:style>
  <style:style style:name="Title" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.2in"/><style:text-properties fo:font-size="20pt" fo:font-weight="bold" fo:color="#123F6D"/></style:style>
  <style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.22in" fo:margin-bottom="0.1in"/><style:text-properties fo:font-size="15pt" fo:font-weight="bold" fo:color="#123F6D"/></style:style>
  <style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.16in" fo:margin-bottom="0.08in"/><style:text-properties fo:font-size="12pt" fo:font-weight="bold"/></style:style>
  <text:list-style style:name="L1"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/></text:list-style>
 </office:styles>
</office:document-styles>`;

    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
 xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
 office:version="1.3">
 <office:meta>
  <meta:generator>CÍCLOPE FP</meta:generator>
  <meta:title>Memoria de Redes de Enseñanzas Profesionales</meta:title>
 </office:meta>
</office:document-meta>`;

    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
 <manifest:file-entry manifest:full-path="/" manifest:media-type="${mime}"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

    zip.file('content.xml', contentXml);
    zip.file('styles.xml', stylesXml);
    zip.file('meta.xml', metaXml);
    zip.folder('META-INF')!.file('manifest.xml', manifest);

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      mimeType: mime,
    });
  }

  private formatDate(value: string | Date) {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeZone: process.env.APP_TIME_ZONE || 'Atlantic/Canary',
    }).format(new Date(value));
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
