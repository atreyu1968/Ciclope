'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  resend: {
    enabled: boolean;
    configured: boolean;
    fromEmail?: string | null;
    fromName?: string | null;
  };
  ai: {
    enabled: boolean;
    configured: boolean;
    providerName?: string | null;
    baseUrl?: string | null;
    model?: string | null;
  };
};

function errorMessage(body: any, fallback: string) {
  return Array.isArray(body?.message) ? body.message.join(' ') : body?.message || fallback;
}

export default function IntegrationsAdminPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState('');
  const [saving, setSaving] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch('/api/integrations');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(errorMessage(body, 'No se pudo cargar la configuración de integraciones.'));
      setLoading(false);
      return;
    }
    setError('');
    setSettings(body);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function saveResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('resend');
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/integrations/resend', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: form.get('enabled') === 'on',
        fromEmail: form.get('fromEmail'),
        fromName: form.get('fromName'),
        apiKey: form.get('apiKey') || undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving('');
    if (!response.ok) {
      setError(errorMessage(body, 'No se pudo guardar Resend.'));
      return;
    }
    setSettings(body);
    setMessage('Configuración de Resend guardada.');
    event.currentTarget.querySelector<HTMLInputElement>('input[name="apiKey"]')!.value = '';
  }

  async function saveAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('ai');
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/integrations/ai', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: form.get('enabled') === 'on',
        providerName: form.get('providerName'),
        baseUrl: form.get('baseUrl'),
        model: form.get('model'),
        apiKey: form.get('apiKey') || undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving('');
    if (!response.ok) {
      setError(errorMessage(body, 'No se pudo guardar la API de IA.'));
      return;
    }
    setSettings(body);
    setMessage('Configuración de IA guardada.');
    event.currentTarget.querySelector<HTMLInputElement>('input[name="apiKey"]')!.value = '';
  }

  async function test(kind: 'resend' | 'ai') {
    setTesting(kind);
    setMessage('');
    setError('');
    const response = await fetch('/api/integrations/' + kind + '/test', { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    setTesting('');
    if (!response.ok) {
      setError(errorMessage(body, 'La prueba no se pudo completar.'));
      return;
    }
    setMessage(kind === 'resend'
      ? 'Resend funciona. Se ha enviado un correo de prueba a tu cuenta.'
      : 'La API de IA ha respondido correctamente.');
  }

  if (!settings) {
    return (
      <main className="shell">
        {error ? <div className="errorBox" role="alert">{error}</div> : (
          <div className="loadingState" role="status" aria-live="polite">
            <span className="loadingSpinner" aria-hidden="true" />
            <strong>{loading ? 'Cargando integraciones…' : 'Preparando configuración…'}</strong>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Integraciones</h1>
          <p className="lead">
            Configura los servicios externos del centro. Las claves se cifran antes de almacenarse y nunca se vuelven a mostrar.
          </p>
        </div>
        <a className="secondaryButton" href="/">Volver</a>
      </div>

      {message && <div className="notice" role="status" aria-live="polite">{message}</div>}
      {error && <div className="errorBox" role="alert">{error}</div>}

      <section className="adminGrid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Correo transaccional</p>
              <h2>Resend</h2>
            </div>
            <span className={settings.resend.configured ? 'badge success' : 'badge'}>
              {settings.resend.configured ? 'Configurado' : 'Pendiente'}
            </span>
          </div>
          <p className="hint">
            Se usa para comunicaciones, recordatorios de respuesta y avisos automáticos de tareas.
          </p>
          <form className="compactForm" onSubmit={saveResend}>
            <label className="checkCard">
              <input type="checkbox" name="enabled" defaultChecked={settings.resend.enabled} />
              <span>Activar envíos por Resend</span>
            </label>
            <label>Nombre del remitente
              <input name="fromName" required defaultValue={settings.resend.fromName || 'CÍCLOPE FP'} />
            </label>
            <label>Correo remitente
              <input type="email" name="fromEmail" required defaultValue={settings.resend.fromEmail || ''} placeholder="ciclope@tu-dominio.es" />
            </label>
            <label>API Key de Resend
              <input type="password" name="apiKey" autoComplete="new-password" placeholder={settings.resend.configured ? 'Dejar vacío para conservar la actual' : 're_…'} />
            </label>
            <p className="hint">El dominio del remitente debe estar autorizado en tu cuenta de Resend.</p>
            <div className="rowActions">
              <button className="primaryButton" disabled={Boolean(saving) || Boolean(testing)}>
                {saving === 'resend' ? 'Guardando…' : 'Guardar Resend'}
              </button>
              <button className="secondaryButton" type="button" disabled={!settings.resend.enabled || Boolean(testing) || Boolean(saving)} onClick={() => void test('resend')}>
                {testing === 'resend' ? 'Probando…' : 'Enviar prueba'}
              </button>
            </div>
          </form>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Asistencia inteligente</p>
              <h2>API de IA</h2>
            </div>
            <span className={settings.ai.configured ? 'badge success' : 'badge'}>
              {settings.ai.configured ? 'Configurada' : 'Pendiente'}
            </span>
          </div>
          <p className="hint">
            Se utiliza para interpretar indicadores y redactar borradores de memoria. La integración espera una API compatible con Chat Completions.
          </p>
          <form className="compactForm" onSubmit={saveAi}>
            <label className="checkCard">
              <input type="checkbox" name="enabled" defaultChecked={settings.ai.enabled} />
              <span>Activar asistencia de IA</span>
            </label>
            <label>Proveedor
              <input name="providerName" required defaultValue={settings.ai.providerName || ''} placeholder="Proveedor de IA" />
            </label>
            <label>URL base de la API
              <input type="url" name="baseUrl" required defaultValue={settings.ai.baseUrl || ''} placeholder="https://api.proveedor.com/v1" />
            </label>
            <label>Modelo
              <input name="model" required defaultValue={settings.ai.model || ''} placeholder="nombre-del-modelo" />
            </label>
            <label>API Key
              <input type="password" name="apiKey" autoComplete="new-password" placeholder={settings.ai.configured ? 'Dejar vacío para conservar la actual' : 'Clave de la API'} />
            </label>
            <p className="hint">
              CÍclope no envía la clave al navegador. Para interpretar informes solo se remiten datos agregados, sin el listado nominal del profesorado.
            </p>
            <div className="rowActions">
              <button className="primaryButton" disabled={Boolean(saving) || Boolean(testing)}>
                {saving === 'ai' ? 'Guardando…' : 'Guardar IA'}
              </button>
              <button className="secondaryButton" type="button" disabled={!settings.ai.enabled || Boolean(testing) || Boolean(saving)} onClick={() => void test('ai')}>
                {testing === 'ai' ? 'Probando…' : 'Probar conexión'}
              </button>
            </div>
          </form>
        </article>
      </section>
    </main>
  );
}
