-- 013_email_templates.sql
-- Creates the email_templates table so email content can be managed
-- from the admin panel without redeploying edge functions.
-- Seeds 6 default templates.
-- Fully idempotent.

-- ============================================================
-- email_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS salim_et.email_templates (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    subject     text NOT NULL,
    html_body   text NOT NULL,
    variables   text[] NOT NULL DEFAULT '{}',
    updated_at  timestamptz DEFAULT now()
);

ALTER TABLE salim_et.email_templates ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
DROP POLICY IF EXISTS "email_templates: admin all" ON salim_et.email_templates;
CREATE POLICY "email_templates: admin all"
    ON salim_et.email_templates
    FOR ALL
    TO authenticated
    USING (salim_et.is_admin())
    WITH CHECK (salim_et.is_admin());

-- ============================================================
-- Seed default templates
-- Uses INSERT ... ON CONFLICT DO NOTHING so re-runs are safe.
-- Admin edits update the row in place; we never overwrite edits.
-- ============================================================

-- 1. group_invitation
INSERT INTO salim_et.email_templates (id, name, subject, variables, html_body)
VALUES (
  'group_invitation',
  'Invitación a equipo',
  'Invitación al grupo "{{group_name}}" — ExcellenceTracker',
  ARRAY['invite_link','group_name','invited_by_name','site_url'],
  $BODY$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invitación a {{group_name}} — ExcellenceTracker</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);
                     padding:32px 40px;text-align:center;">
            <img src="{{site_url}}/logo.png" alt="ExcellenceTracker"
                 width="48" height="48"
                 style="border-radius:12px;margin-bottom:14px;display:block;
                        margin-left:auto;margin-right:auto;">
            <p style="margin:0;font-size:22px;font-weight:700;
                      color:#ffffff;letter-spacing:-0.3px;">
              ExcellenceTracker
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">

            <!-- Badge -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:24px;">
              <tr>
                <td style="background:#eef2ff;border-radius:20px;
                           padding:6px 14px;font-size:12px;font-weight:600;
                           color:#6366f1;letter-spacing:0.5px;">
                  INVITACIÓN AL EQUIPO
                </td>
              </tr>
            </table>

            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;
                       color:#111827;line-height:1.2;">
              {{invited_by_name}} te invita a unirte
            </h1>
            <p style="margin:0 0 24px;font-size:16px;color:#6b7280;">
              Te han agregado al grupo:
            </p>

            <!-- Group name highlight -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:28px;">
              <tr>
                <td style="background:#eef2ff;border-radius:12px;
                           padding:20px 24px;text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:700;color:#6366f1;">
                    {{group_name}}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
              Al aceptar podrás participar en los servicios programados
              y ver tu historial de evaluaciones.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:32px;">
              <tr>
                <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);
                           border-radius:10px;box-shadow:0 4px 12px rgba(99,102,241,.35);">
                  <a href="{{invite_link}}"
                     style="display:inline-block;padding:16px 36px;font-size:16px;
                            font-weight:600;color:#ffffff;text-decoration:none;
                            border-radius:10px;letter-spacing:0.2px;">
                    Unirme al grupo →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#f9fafb;border-radius:10px;border-left:4px solid #6366f1;
                           padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                    ⏱ Este enlace <strong style="color:#374151;">expira en 7 días</strong>.
                    Si no esperabas este correo, puedes ignorarlo sin problema.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </p>
            <p style="margin:0;font-size:12px;text-align:center;word-break:break-all;">
              <a href="{{invite_link}}" style="color:#6366f1;text-decoration:none;">
                {{invite_link}}
              </a>
            </p>
            <p style="margin:24px 0 0;font-size:11px;color:#d1d5db;text-align:center;">
              © ExcellenceTracker. Todos los derechos reservados.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>$BODY$
) ON CONFLICT (id) DO NOTHING;

-- 2. coordinator_invitation
INSERT INTO salim_et.email_templates (id, name, subject, variables, html_body)
VALUES (
  'coordinator_invitation',
  'Invitación a coordinador',
  'Invitación como Coordinador — ExcellenceTracker',
  ARRAY['invite_link','site_url'],
  $BODY$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invitación — ExcellenceTracker</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);
                     padding:32px 40px;text-align:center;">
            <img src="{{site_url}}/logo.png" alt="ExcellenceTracker"
                 width="48" height="48"
                 style="border-radius:12px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;">
            <p style="margin:0;font-size:22px;font-weight:700;
                      color:#ffffff;letter-spacing:-0.3px;">
              ExcellenceTracker
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">

            <!-- Badge -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:24px;">
              <tr>
                <td style="background:#eef2ff;border-radius:20px;
                           padding:6px 14px;font-size:12px;font-weight:600;
                           color:#6366f1;letter-spacing:0.5px;">
                  NUEVA INVITACIÓN
                </td>
              </tr>
            </table>

            <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;
                       color:#111827;line-height:1.2;">
              Fuiste invitado como<br>Coordinador
            </h1>

            <p style="margin:0 0 28px;font-size:16px;color:#6b7280;line-height:1.6;">
              Has recibido una invitación para unirte a
              <strong style="color:#374151;">ExcellenceTracker</strong>
              como coordinador. Podrás crear grupos, programar servicios
              y evaluar el desempeño de tu equipo.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:32px;">
              <tr>
                <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);
                           border-radius:10px;box-shadow:0 4px 12px rgba(99,102,241,.35);">
                  <a href="{{invite_link}}"
                     style="display:inline-block;padding:16px 36px;font-size:16px;
                            font-weight:600;color:#ffffff;text-decoration:none;
                            border-radius:10px;letter-spacing:0.2px;">
                    Aceptar invitación →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#f9fafb;border-radius:10px;border-left:4px solid #6366f1;
                           padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                    ⏱ Este enlace <strong style="color:#374151;">expira en 30 días</strong>.
                    Si no esperabas este correo, puedes ignorarlo sin problema.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </p>
            <p style="margin:0;font-size:12px;text-align:center;word-break:break-all;">
              <a href="{{invite_link}}" style="color:#6366f1;text-decoration:none;">
                {{invite_link}}
              </a>
            </p>
            <p style="margin:24px 0 0;font-size:11px;color:#d1d5db;text-align:center;">
              © ExcellenceTracker. Todos los derechos reservados.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>$BODY$
) ON CONFLICT (id) DO NOTHING;

-- 3. invitation_accepted (coordinator notification)
INSERT INTO salim_et.email_templates (id, name, subject, variables, html_body)
VALUES (
  'invitation_accepted',
  'Miembro aceptó invitación',
  '{{member_name}} se unió a tu grupo — ExcellenceTracker',
  ARRAY['member_name','group_name','member_email','site_url'],
  $BODY$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Nuevo miembro — ExcellenceTracker</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">

      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);
                     padding:32px 40px;text-align:center;">
            <img src="{{site_url}}/logo.png" alt="ExcellenceTracker"
                 width="48" height="48"
                 style="border-radius:12px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
              ExcellenceTracker
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">

            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
              <tr>
                <td style="background:#d1fae5;border-radius:20px;padding:6px 14px;
                           font-size:12px;font-weight:600;color:#059669;letter-spacing:0.5px;">
                  NUEVO MIEMBRO
                </td>
              </tr>
            </table>

            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#111827;line-height:1.2;">
              ¡{{member_name}} aceptó tu invitación!
            </h1>
            <p style="margin:0 0 24px;font-size:16px;color:#6b7280;">
              Se ha unido a tu grupo:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:28px;">
              <tr>
                <td style="background:#ecfdf5;border-radius:12px;padding:20px 24px;text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:700;color:#059669;">
                    {{group_name}}
                  </p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#f9fafb;border-radius:10px;border-left:4px solid #10b981;
                           padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                    📧 Correo del nuevo miembro:
                    <strong style="color:#374151;">{{member_email}}</strong>
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#d1d5db;text-align:center;">
              © ExcellenceTracker. Todos los derechos reservados.
            </p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>

</body>
</html>$BODY$
) ON CONFLICT (id) DO NOTHING;

-- 4. password_reset
INSERT INTO salim_et.email_templates (id, name, subject, variables, html_body)
VALUES (
  'password_reset',
  'Restablecimiento de contraseña',
  'Restablecer contraseña — ExcellenceTracker',
  ARRAY['reset_link','site_url'],
  $BODY$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Restablecer contraseña — ExcellenceTracker</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);
                     padding:32px 40px;text-align:center;">
            <img src="{{site_url}}/logo.png" alt="ExcellenceTracker" width="48" height="48"
                 style="border-radius:12px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">ExcellenceTracker</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">
              Restablecer contraseña
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta.
              Haz clic en el botón de abajo para continuar. Si no solicitaste esto, ignora este correo.
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:10px;
                           box-shadow:0 4px 12px rgba(99,102,241,.35);">
                  <a href="{{reset_link}}"
                     style="display:inline-block;padding:16px 36px;font-size:16px;
                            font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                    Restablecer contraseña →
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#f9fafb;border-radius:10px;border-left:4px solid #6366f1;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                    ⏱ Este enlace <strong style="color:#374151;">expira en 1 hora</strong>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;">
              Si el botón no funciona, copia y pega este enlace:
            </p>
            <p style="margin:0;font-size:12px;text-align:center;word-break:break-all;">
              <a href="{{reset_link}}" style="color:#6366f1;text-decoration:none;">{{reset_link}}</a>
            </p>
            <p style="margin:24px 0 0;font-size:11px;color:#d1d5db;text-align:center;">
              © ExcellenceTracker. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$BODY$
) ON CONFLICT (id) DO NOTHING;

-- 5. evaluation_received
INSERT INTO salim_et.email_templates (id, name, subject, variables, html_body)
VALUES (
  'evaluation_received',
  'Evaluación recibida',
  'Evaluación registrada — ExcellenceTracker',
  ARRAY['member_name','service_date','group_name','site_url'],
  $BODY$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Evaluación registrada — ExcellenceTracker</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);
                     padding:32px 40px;text-align:center;">
            <img src="{{site_url}}/logo.png" alt="ExcellenceTracker" width="48" height="48"
                 style="border-radius:12px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">ExcellenceTracker</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
              <tr>
                <td style="background:#fef3c7;border-radius:20px;padding:6px 14px;
                           font-size:12px;font-weight:600;color:#d97706;letter-spacing:0.5px;">
                  EVALUACIÓN REGISTRADA
                </td>
              </tr>
            </table>
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#111827;line-height:1.2;">
              Hola, {{member_name}}
            </h1>
            <p style="margin:0 0 24px;font-size:16px;color:#6b7280;line-height:1.6;">
              Tu coordinador ha registrado una evaluación de tu participación en el servicio
              del <strong style="color:#374151;">{{service_date}}</strong>
              en el grupo <strong style="color:#374151;">{{group_name}}</strong>.
            </p>
            <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
              Puedes ver los detalles de tu evaluación iniciando sesión en ExcellenceTracker.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#d1d5db;text-align:center;">
              © ExcellenceTracker. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$BODY$
) ON CONFLICT (id) DO NOTHING;

-- 6. service_assignment
INSERT INTO salim_et.email_templates (id, name, subject, variables, html_body)
VALUES (
  'service_assignment',
  'Asignación de servicio',
  'Fuiste asignado a un servicio — ExcellenceTracker',
  ARRAY['member_name','service_date','group_name','role','site_url'],
  $BODY$<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Asignación de servicio — ExcellenceTracker</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);
                     padding:32px 40px;text-align:center;">
            <img src="{{site_url}}/logo.png" alt="ExcellenceTracker" width="48" height="48"
                 style="border-radius:12px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">ExcellenceTracker</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
              <tr>
                <td style="background:#eef2ff;border-radius:20px;padding:6px 14px;
                           font-size:12px;font-weight:600;color:#6366f1;letter-spacing:0.5px;">
                  ASIGNACIÓN DE SERVICIO
                </td>
              </tr>
            </table>
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#111827;line-height:1.2;">
              Hola, {{member_name}}
            </h1>
            <p style="margin:0 0 24px;font-size:16px;color:#6b7280;line-height:1.6;">
              Has sido asignado como <strong style="color:#374151;">{{role}}</strong>
              en el servicio del <strong style="color:#374151;">{{service_date}}</strong>
              en el grupo <strong style="color:#374151;">{{group_name}}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#f9fafb;border-radius:10px;border-left:4px solid #6366f1;
                           padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                    Inicia sesión en ExcellenceTracker para ver más detalles sobre el servicio.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#d1d5db;text-align:center;">
              © ExcellenceTracker. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$BODY$
) ON CONFLICT (id) DO NOTHING;
