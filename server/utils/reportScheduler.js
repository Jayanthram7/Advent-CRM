const User = require('../models/User');
const Lead = require('../models/Lead');
const Call = require('../models/Call');
const EventRecord = require('../models/EventRecord');
const TssRecord = require('../models/TssRecord');
const Activity = require('../models/Activity');
const AdminSetting = require('../models/AdminSetting');
const sendEmail = require('./mailer');

const sendDailyReportHelper = async (targetDate) => {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const formattedDateString = startOfDay.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Fetch active users, excluding super-admin and jayanth accounts
  const allUsers = await User.find({ status: 'Active' }).select('name email role');
  const users = allUsers.filter(u => 
    u.email !== 'jayanthramnithin@gmail.com' && 
    !u.name.toLowerCase().includes('jayanth')
  );

  const reportData = await Promise.all(users.map(async (u) => {
    const [
      leadsAdded,
      callsAdded,
      tssAdded,
      eventsAdded,
      leadsFollowUps,
      callsFollowUps,
      tssFollowUps,
      eventsFollowUps
    ] = await Promise.all([
      Lead.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Call.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      TssRecord.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      EventRecord.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),

      // Follow Up Columns (Date updates or Label changes containing "Follow Up" performed today/target day)
      Activity.countDocuments({
        performedBy: u._id,
        lead: { $exists: true },
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        $or: [
          { type: 'DateUpdate' },
          { type: 'Label', content: { $regex: /Follow Up/i } }
        ]
      }),
      Activity.countDocuments({
        performedBy: u._id,
        call: { $exists: true },
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        $or: [
          { type: 'DateUpdate' },
          { type: 'Label', content: { $regex: /Follow Up/i } }
        ]
      }),
      Activity.countDocuments({
        performedBy: u._id,
        tssRecord: { $exists: true },
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        $or: [
          { type: 'DateUpdate' },
          { type: 'Label', content: { $regex: /Follow Up/i } }
        ]
      }),
      Activity.countDocuments({
        performedBy: u._id,
        eventRecord: { $exists: true },
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        $or: [
          { type: 'DateUpdate' },
          { type: 'Label', content: { $regex: /Follow Up/i } }
        ]
      })
    ]);

    return {
      name: u.name,
      email: u.email,
      role: u.role,
      leadsAdded,
      callsAdded,
      tssAdded,
      eventsAdded,
      leadsFollowUps,
      callsFollowUps,
      tssFollowUps,
      eventsFollowUps
    };
  }));

  const [closedLeads, closedCalls, closedEvents, closedTss] = await Promise.all([
    Lead.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
    Call.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
    EventRecord.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
    TssRecord.countDocuments({ status: 'Closed', updatedAt: { $gte: startOfDay, $lte: endOfDay } })
  ]);

  const closedTotal = closedLeads + closedCalls + closedEvents + closedTss;

  const totalLeadsAdded = reportData.reduce((sum, r) => sum + r.leadsAdded, 0);
  const totalLeadsFollowUps = reportData.reduce((sum, r) => sum + r.leadsFollowUps, 0);
  const totalCallsAdded = reportData.reduce((sum, r) => sum + r.callsAdded, 0);
  const totalCallsFollowUps = reportData.reduce((sum, r) => sum + r.callsFollowUps, 0);
  const totalTssAdded = reportData.reduce((sum, r) => sum + r.tssAdded, 0);
  const totalTssFollowUps = reportData.reduce((sum, r) => sum + r.tssFollowUps, 0);
  const totalEventsAdded = reportData.reduce((sum, r) => sum + r.eventsAdded, 0);
  const totalEventsFollowUps = reportData.reduce((sum, r) => sum + r.eventsFollowUps, 0);

  const tableRowsHtml = reportData.map(r => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 14px; text-align: left; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #0f172a; font-size: 13.5px;">${r.name}</div>
        <div style="font-size: 11px; color: #64748b;">${r.email} • ${r.role}</div>
      </td>
      <td style="padding: 12px 14px; text-align: center; font-size: 13.5px; border-bottom: 1px solid #e2e8f0;">
        <strong style="color: #0f172a;">${r.leadsAdded}</strong> <span style="color: #94a3b8; margin: 0 4px;">/</span> <span style="color: #2563eb; font-weight: 600;">${r.leadsFollowUps}</span>
      </td>
      <td style="padding: 12px 14px; text-align: center; font-size: 13.5px; border-bottom: 1px solid #e2e8f0;">
        <strong style="color: #0f172a;">${r.callsAdded}</strong> <span style="color: #94a3b8; margin: 0 4px;">/</span> <span style="color: #2563eb; font-weight: 600;">${r.callsFollowUps}</span>
      </td>
      <td style="padding: 12px 14px; text-align: center; font-size: 13.5px; border-bottom: 1px solid #e2e8f0;">
        <strong style="color: #0f172a;">${r.tssAdded}</strong> <span style="color: #94a3b8; margin: 0 4px;">/</span> <span style="color: #2563eb; font-weight: 600;">${r.tssFollowUps}</span>
      </td>
      <td style="padding: 12px 14px; text-align: center; font-size: 13.5px; border-bottom: 1px solid #e2e8f0;">
        <strong style="color: #0f172a;">${r.eventsAdded}</strong> <span style="color: #94a3b8; margin: 0 4px;">/</span> <span style="color: #2563eb; font-weight: 600;">${r.eventsFollowUps}</span>
      </td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:640px;margin:0 auto;box-sizing:border-box;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 32px 28px;border-radius:12px 12px 0 0;text-align:center;">
        <h2 style="color:#f8fafc;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Advent CRM</h2>
        <p style="color:#38bdf8;margin:8px 0 0;font-size:13.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Performance Report</p>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">Report date: ${formattedDateString}</p>
      </div>

      <!-- Body -->
      <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;box-sizing:border-box;">
        
        <!-- Table Header -->
        <div style="background:#1a1f36;padding:12px 16px;border-radius:8px 8px 0 0;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-align:left;">
          Agent Activity Summary (New / Follow-Up)
        </div>
        
        <!-- Table -->
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;margin-bottom:28px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#475569;font-weight:600;font-size:11px;text-align:left;text-transform:uppercase;">Account / Agent</th>
              <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#1e293b;font-weight:700;font-size:11px;text-align:center;text-transform:uppercase;">Leads <span style="font-weight:400;color:#64748b;font-size:9.5px;">(New/F.Up)</span></th>
              <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#1e293b;font-weight:700;font-size:11px;text-align:center;text-transform:uppercase;">Calls <span style="font-weight:400;color:#64748b;font-size:9.5px;">(New/F.Up)</span></th>
              <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#1e293b;font-weight:700;font-size:11px;text-align:center;text-transform:uppercase;">TSS <span style="font-weight:400;color:#64748b;font-size:9.5px;">(New/F.Up)</span></th>
              <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#1e293b;font-weight:700;font-size:11px;text-align:center;text-transform:uppercase;">Events <span style="font-weight:400;color:#64748b;font-size:9.5px;">(New/F.Up)</span></th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background:#f8fafc;font-weight:700;border-top:2px solid #cbd5e1;">
              <td style="padding:12px 14px;color:#1e293b;font-size:12.5px;text-transform:uppercase;letter-spacing:0.05em;border-top:2px solid #cbd5e1;">Total</td>
              <td style="padding:12px 14px;text-align:center;font-size:13.5px;border-top:2px solid #cbd5e1;">
                <strong style="color:#0f172a;">${totalLeadsAdded}</strong> <span style="color:#94a3b8;margin:0 4px;">/</span> <span style="color:#2563eb;font-weight:700;">${totalLeadsFollowUps}</span>
              </td>
              <td style="padding:12px 14px;text-align:center;font-size:13.5px;border-top:2px solid #cbd5e1;">
                <strong style="color:#0f172a;">${totalCallsAdded}</strong> <span style="color:#94a3b8;margin:0 4px;">/</span> <span style="color:#2563eb;font-weight:700;">${totalCallsFollowUps}</span>
              </td>
              <td style="padding:12px 14px;text-align:center;font-size:13.5px;border-top:2px solid #cbd5e1;">
                <strong style="color:#0f172a;">${totalTssAdded}</strong> <span style="color:#94a3b8;margin:0 4px;">/</span> <span style="color:#2563eb;font-weight:700;">${totalTssFollowUps}</span>
              </td>
              <td style="padding:12px 14px;text-align:center;font-size:13.5px;border-top:2px solid #cbd5e1;">
                <strong style="color:#0f172a;">${totalEventsAdded}</strong> <span style="color:#94a3b8;margin:0 4px;">/</span> <span style="color:#2563eb;font-weight:700;">${totalEventsFollowUps}</span>
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Closed Section Title -->
        <div style="font-size:13.5px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.02em;margin-bottom:12px;">
          Closed Records Overview
        </div>

        <!-- Closed Stats Table -->
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-spacing:0;margin-bottom:12px;">
          <tr>
            <td style="width:20%;padding:4px;vertical-align:top;">
              <div style="background:linear-gradient(135deg,#059669,#10b981);padding:14px 10px;border-radius:8px;color:#ffffff;text-align:center;min-height:76px;box-sizing:border-box;">
                <div style="font-size:9.5px;font-weight:600;opacity:0.9;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Total Closed</div>
                <div style="font-size:24px;font-weight:800;">${closedTotal}</div>
              </div>
            </td>
            <td style="width:20%;padding:4px;vertical-align:top;">
              <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 10px;border-radius:8px;text-align:center;min-height:76px;box-sizing:border-box;">
                <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Leads</div>
                <div style="font-size:20px;font-weight:700;color:#0f172a;">${closedLeads}</div>
              </div>
            </td>
            <td style="width:20%;padding:4px;vertical-align:top;">
              <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 10px;border-radius:8px;text-align:center;min-height:76px;box-sizing:border-box;">
                <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Calls</div>
                <div style="font-size:20px;font-weight:700;color:#0f172a;">${closedCalls}</div>
              </div>
            </td>
            <td style="width:20%;padding:4px;vertical-align:top;">
              <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 10px;border-radius:8px;text-align:center;min-height:76px;box-sizing:border-box;">
                <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">TSS</div>
                <div style="font-size:20px;font-weight:700;color:#0f172a;">${closedTss}</div>
              </div>
            </td>
            <td style="width:20%;padding:4px;vertical-align:top;">
              <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 10px;border-radius:8px;text-align:center;min-height:76px;box-sizing:border-box;">
                <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Events</div>
                <div style="font-size:20px;font-weight:700;color:#0f172a;">${closedEvents}</div>
              </div>
            </td>
          </tr>
        </table>

      </div>
    </div>
  `;

  const recipients = ['adventsystems@gmail.com', 'jayanthramnithin@gmail.com'];
  await Promise.all(recipients.map(email => 
    sendEmail({
      to: email,
      subject: `Automatic Daily Performance Report — ${formattedDateString}`,
      html: htmlContent
    }).catch(err => {
      console.error(`[Scheduler] Failed to send automated report to ${email}:`, err);
    })
  ));
  console.log(`[Scheduler] Automated daily reports successfully dispatched to ${recipients.join(', ')}.`);
};

const startDailyReportScheduler = () => {
  console.log('🚀 Daily Performance Report Scheduler initialized.');

  // Run a check every 30 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Everyday at 6:30 PM (18:30) local time
      if (currentHour === 18 && currentMinute === 30) {
        const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD local format
        
        let setting = await AdminSetting.findOne({ type: 'last_daily_report_sent' });
        if (!setting || setting.password !== todayStr) {
          console.log(`[Scheduler] Time matches 18:30 (6:30 PM). Sending daily report for ${todayStr}...`);
          
          await sendDailyReportHelper(now);
          
          if (!setting) {
            await AdminSetting.create({ type: 'last_daily_report_sent', password: todayStr });
          } else {
            setting.password = todayStr;
            await setting.save();
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error running daily report cron:', err);
    }
  }, 30000);
};

module.exports = { startDailyReportScheduler };
