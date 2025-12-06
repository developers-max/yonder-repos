/**
 * Email template for realtor outreach
 * 
 * Variables available:
 * {{first_name}} - Realtor's first name
 * {{plot_url}} - URL to the plot details page
 */

export const realtorOutreachTemplate = `Hi {{first_name}},

A buyer just searched for your plot on Yonder and started exploring it with our <b>Land Chat (AI)</b> tool.

To help them move forward, you can <b>claim the plot</b> and add the real location in private.
This lets our system check zoning, cadastre/BUPi, PDM and buildability, and create a clear Land AI report the buyer can use to understand the plot better.

The location stays private and is never shown on the public page or shared with the buyer.
It's only used for the report and to notify you when a buyer starts one — giving you a <b>serious-buyer signal</b>.

Using Land Chat is free and you can share the tool anywhere (Idealista, your site, WhatsApp) across all your plots.
You only upgrade if you want access to the buyer's full report.

If you want to activate the plot, reply with the plot details or an Idealista link and we'll set it up so you can claim it in one click.

Thanks,
Tim / Yonder`;


/**
 * Default subject line for realtor outreach emails
 */
export const defaultSubject = 'A buyer just looked at your plot on Yonder';
