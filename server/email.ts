import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.zoho.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface ExpertInvitationEmailParams {
  expertName: string;
  expertEmail: string;
  projectName: string;
  clientName: string;
  industry?: string;
  invitationUrl: string;
  vettingQuestionsCount: number;
}

export async function sendExpertInvitationEmail(params: ExpertInvitationEmailParams): Promise<boolean> {
  const {
    expertName,
    expertEmail,
    projectName,
    clientName,
    industry,
    invitationUrl,
    vettingQuestionsCount,
  } = params;

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Invitation - Mirae Connext</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 1px solid #eaeaea;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">Mirae Connext</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                Hello ${expertName},
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                You have been invited to participate in a new project opportunity through Mirae Connext.
              </p>
              
              <!-- Project Details Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; font-size: 14px; color: #666;">PROJECT</p>
                    <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #1a1a1a;">${projectName}</p>
                    
                    <p style="margin: 0 0 8px; font-size: 14px; color: #666;">CLIENT</p>
                    <p style="margin: 0 0 16px; font-size: 16px; color: #333;">${clientName}</p>
                    
                    ${industry ? `
                    <p style="margin: 0 0 8px; font-size: 14px; color: #666;">INDUSTRY</p>
                    <p style="margin: 0; font-size: 16px; color: #333;">${industry}</p>
                    ` : ''}
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333;">
                Please review the project details and let us know if you're interested in participating. 
                ${vettingQuestionsCount > 0 ? `There are ${vettingQuestionsCount} screening question${vettingQuestionsCount > 1 ? 's' : ''} to help us understand your expertise.` : ''}
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${invitationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0066cc; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 6px;">
                      View Project &amp; Respond
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 8px; font-size: 14px; color: #666;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 14px; color: #0066cc; word-break: break-all;">
                ${invitationUrl}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #eaeaea; background-color: #fafafa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #888;">
                This invitation was sent by Mirae Connext Expert Network.
              </p>
              <p style="margin: 0; font-size: 13px; color: #888;">
                If you have any questions, please contact us at ${fromEmail}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
Hello ${expertName},

You have been invited to participate in a new project opportunity through Mirae Connext.

PROJECT: ${projectName}
CLIENT: ${clientName}
${industry ? `INDUSTRY: ${industry}` : ''}

Please review the project details and let us know if you're interested in participating.
${vettingQuestionsCount > 0 ? `There are ${vettingQuestionsCount} screening question${vettingQuestionsCount > 1 ? 's' : ''} to help us understand your expertise.` : ''}

View Project & Respond: ${invitationUrl}

---
This invitation was sent by Mirae Connext Expert Network.
If you have any questions, please contact us at ${fromEmail}
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Mirae Connext" <${fromEmail}>`,
      to: expertEmail,
      subject: `Project Invitation: ${projectName} - Mirae Connext`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`Email sent successfully to ${expertEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${expertEmail}:`, error);
    return false;
  }
}

export async function verifySmtpConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log("SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("SMTP connection verification failed:", error);
    return false;
  }
}
