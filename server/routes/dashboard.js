const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Call = require('../models/Call');
const TssRecord = require('../models/TssRecord');
const EventRecord = require('../models/EventRecord');
const authMiddleware = require('../middleware/authMiddleware');
const CalendarEvent = require('../models/CalendarEvent');

router.use(authMiddleware);

// Helper to count document statuses
async function getModelOverview(Model, baseQuery, modelName) {
  const isTss = modelName === 'TSS';
  
  const [total, open, followUp, installation, converted] = await Promise.all([
    Model.countDocuments(baseQuery),
    Model.countDocuments({ 
      ...baseQuery, 
      labels: 'Open', 
      ...(isTss ? {} : { isConverted: { $ne: true } })
    }),
    Model.countDocuments({ 
      ...baseQuery, 
      labels: 'Follow Up' 
    }),
    Model.countDocuments({ 
      ...baseQuery, 
      $or: [
        { labels: 'Review' },
        ...(isTss ? [] : [{ installationDate: { $ne: null } }])
      ]
    }),
    Model.countDocuments({ 
      ...baseQuery, 
      $or: [
        ...(isTss ? [] : [{ isConverted: true }]),
        { labels: { $in: ['Completed', 'Closed'] } }
      ]
    })
  ]);

  const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';

  return {
    total,
    open,
    followUp,
    installation,
    converted,
    conversionRate
  };
}

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;
    const isAgent = req.user.role === 'Agent';
    const baseQuery = isAgent ? { assignedTo: userId } : {};

    // Get overviews for all models
    const [tssOverview, leadsOverview, callsOverview, eventsOverview] = await Promise.all([
      getModelOverview(TssRecord, baseQuery, 'TSS'),
      getModelOverview(Lead, baseQuery, 'Lead'),
      getModelOverview(Call, baseQuery, 'Call'),
      getModelOverview(EventRecord, baseQuery, 'Event')
    ]);

    // Basic counts
    const [totalLeads, convertedLeads, openLeads] = [
      leadsOverview.total,
      leadsOverview.converted,
      leadsOverview.open
    ];

    // Leads per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const leadsPerDay = await Lead.aggregate([
      {
        $match: {
          ...( isAgent ? { assignedTo: userId } : {}),
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Leads per month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const leadsPerMonth = await Lead.aggregate([
      {
        $match: {
          ...(isAgent ? { assignedTo: userId } : {}),
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Leads by source
    const leadsBySource = await Lead.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$leadSource',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Conversion over time (last 12 months)
    const conversionData = await Lead.aggregate([
      {
        $match: {
          ...(isAgent ? { assignedTo: userId } : {}),
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' }
          },
          total: { $sum: 1 },
          converted: { $sum: { $cond: ['$isConverted', 1, 0] } }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Labels distribution
    const labelDistribution = await Lead.aggregate([
      { $match: baseQuery },
      { $unwind: '$labels' },
      {
        $group: {
          _id: '$labels',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      stats: {
        totalLeads,
        convertedLeads,
        openLeads,
        conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0
      },
      overviews: {
        tss: tssOverview,
        leads: leadsOverview,
        calls: callsOverview,
        events: eventsOverview
      },
      charts: {
        leadsPerDay: leadsPerDay.map(d => ({ date: d._id, count: d.count })),
        leadsPerMonth: leadsPerMonth.map(d => ({ month: d._id, count: d.count })),
        leadsBySource: leadsBySource.map(d => ({ source: d._id || 'Other', count: d.count })),
        conversionData: conversionData.map(d => ({
          month: d._id,
          total: d.total,
          converted: d.converted,
          rate: d.total > 0 ? ((d.converted / d.total) * 100).toFixed(1) : 0
        })),
        labelDistribution: labelDistribution.map(d => ({ label: d._id, count: d.count }))
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
});

// GET /api/dashboard/leads-per-day
router.get('/leads-per-day', async (req, res) => {
  try {
    const userId = req.user._id;
    const isAgent = req.user.role === 'Agent';
    const { range, startDate, endDate } = req.query;

    let start = new Date();
    let end = new Date();

    if (range === '7d' || range === '1w') {
      start.setUTCDate(end.getUTCDate() - 7);
    } else if (range === '2w') {
      start.setUTCDate(end.getUTCDate() - 14);
    } else if (range === '1m') {
      start.setUTCDate(end.getUTCDate() - 30);
    } else if (range === '1yr') {
      start.setUTCDate(end.getUTCDate() - 365);
    } else if (range === 'custom' && startDate && endDate) {
      start = new Date(startDate + 'T00:00:00.000Z');
      end = new Date(endDate + 'T23:59:59.999Z');
    } else {
      // Default to 30 days
      start.setUTCDate(end.getUTCDate() - 30);
    }

    if (range !== 'custom') {
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
    }

    const leadsPerDay = await Lead.aggregate([
      {
        $match: {
          ...(isAgent ? { assignedTo: userId } : {}),
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const dataMap = new Map(leadsPerDay.map(d => [d._id, d.count]));

    const result = [];
    let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    // Limit to prevent infinite loop or massive payload (e.g. 5 years max)
    const maxDays = 1826;
    let daysCount = 0;

    while (current <= endUTC && daysCount < maxDays) {
      const dateString = current.toISOString().split('T')[0];
      result.push({
        date: dateString,
        count: dataMap.get(dateString) || 0
      });
      current.setUTCDate(current.getUTCDate() + 1);
      daysCount++;
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching leads per day chart:', err);
    res.status(500).json({ message: 'Error fetching chart data' });
  }
});

// GET /api/dashboard/analytics
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user._id;
    const isAgent = req.user.role === 'Agent';
    const { range, startDate, endDate } = req.query;

    let start = new Date();
    let end = new Date();

    if (range === '1w' || range === 'week') {
      start.setUTCDate(end.getUTCDate() - 7);
    } else if (range === '1m' || range === 'month') {
      start.setUTCDate(end.getUTCDate() - 30);
    } else if (range === 'quarter' || range === '3m') {
      start.setUTCDate(end.getUTCDate() - 90);
    } else if (range === '1yr' || range === 'year') {
      start.setUTCDate(end.getUTCDate() - 365);
    } else if (range === 'custom' && startDate && endDate) {
      start = new Date(startDate + 'T00:00:00.000Z');
      end = new Date(endDate + 'T23:59:59.999Z');
    } else {
      // Default to 30 days
      start.setUTCDate(end.getUTCDate() - 30);
    }

    if (range !== 'custom') {
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
    }

    // Aggregate Leads
    const leadsAggregation = await Lead.aggregate([
      {
        $match: {
          ...(isAgent ? { assignedTo: userId } : {}),
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          all_leads: { $sum: 1 },
          converted_leads: {
            $sum: { $cond: [{ $eq: ['$isConverted', true] }, 1, 0] }
          }
        }
      }
    ]);

    // Aggregate Calls
    const callsAggregation = await Call.aggregate([
      {
        $match: {
          ...(isAgent ? { assignedTo: userId } : {}),
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          all_calls: { $sum: 1 },
          open_calls: {
            $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] }
          },
          follow_up_calls: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $isArray: '$labels' },
                    { $in: ['Follow Up', '$labels'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Aggregate Events
    const eventsAggregation = await EventRecord.aggregate([
      {
        $match: {
          ...(isAgent ? { assignedTo: userId } : {}),
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          all_events: { $sum: 1 }
        }
      }
    ]);

    // Aggregate TSS
    const tssAggregation = await TssRecord.aggregate([
      {
        $match: {
          ...(isAgent ? { assignedTo: userId } : {}),
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          all_tss: { $sum: 1 }
        }
      }
    ]);

    const leadsMap = new Map(leadsAggregation.map(d => [d._id, d]));
    const callsMap = new Map(callsAggregation.map(d => [d._id, d]));
    const eventsMap = new Map(eventsAggregation.map(d => [d._id, d]));
    const tssMap = new Map(tssAggregation.map(d => [d._id, d]));

    const result = [];
    let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    const maxDays = 1826;
    let daysCount = 0;

    while (current <= endUTC && daysCount < maxDays) {
      const dateString = current.toISOString().split('T')[0];
      const leadData = leadsMap.get(dateString) || {};
      const callData = callsMap.get(dateString) || {};
      const eventData = eventsMap.get(dateString) || {};
      const tssData = tssMap.get(dateString) || {};

      result.push({
        date: dateString,
        all_leads: leadData.all_leads || 0,
        converted_leads: leadData.converted_leads || 0,
        all_calls: callData.all_calls || 0,
        open_calls: callData.open_calls || 0,
        follow_up_calls: callData.follow_up_calls || 0,
        all_events: eventData.all_events || 0,
        all_tss: tssData.all_tss || 0
      });

      current.setUTCDate(current.getUTCDate() + 1);
      daysCount++;
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching analytics chart:', err);
    res.status(500).json({ message: 'Error fetching chart data' });
  }
});

// GET /api/dashboard/global-search
router.get('/global-search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const isSlash = q.startsWith('/');
    const cleanQ = isSlash ? q.slice(1) : q;

    const escapedQuery = cleanQ.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    if (isSlash) {
      const User = require('../models/User');
      const matchedAgents = await User.find({
        name: regex
      }).limit(5);

      const results = [];
      matchedAgents.forEach(agent => {
        results.push({
          id: agent._id,
          type: 'Agent',
          company: `Agent: ${agent.name}`,
          callerName: `${agent.role} (${agent.email})`,
          url: `/tasks?userId=${agent._id}`
        });
      });
      return res.json(results);
    }

    const isAgent = req.user.role === 'Agent';
    const userId = req.user._id;

    const baseQuery = isAgent ? { assignedTo: userId } : {};

    // Search Leads
    const leads = await Lead.find({
      ...baseQuery,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { company: regex },
        { phone: regex },
        { secondaryPhone: regex },
        { licenseNumber: regex }
      ]
    }).limit(5);

    // Search Calls
    const calls = await Call.find({
      ...baseQuery,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { company: regex },
        { phone: regex },
        { secondaryPhone: regex },
        { licenseNumber: regex }
      ]
    }).limit(5);

    // Search Events
    const events = await EventRecord.find({
      ...baseQuery,
      $or: [
        { companyName: regex },
        { contactPerson: regex },
        { mobile1: regex },
        { mobile2: regex }
      ]
    }).limit(5);

    // Search TSS
    const tss = await TssRecord.find({
      ...baseQuery,
      $or: [
        { customerName: regex },
        { serialNumber: regex },
        { mobileNumber: regex }
      ]
    }).limit(5);

    // Search CalendarEvents
    let calendarQuery = {
      ...baseQuery,
      $or: [
        { title: regex },
        { description: regex }
      ]
    };

    const qLower = q.toLowerCase();
    if (qLower.includes('meeting') || qLower.includes('event')) {
      calendarQuery = {
        ...baseQuery,
        type: { $in: ['Work-Order', 'Move-In', 'Move-Out', 'Note'] }
      };
    } else if (qLower.includes('reminder')) {
      calendarQuery = {
        ...baseQuery,
        type: 'Reminder'
      };
    }

    const calendarEvents = await CalendarEvent.find(calendarQuery).limit(5);

    const results = [];

    // Map Leads
    leads.forEach(l => {
      const callerName = `${l.firstName || ''} ${l.lastName || ''}`.trim();
      const company = l.company || '—';
      const searchVal = company !== '—' ? company : (callerName.split(' ')[0] || callerName);
      results.push({
        id: l._id,
        type: 'Lead',
        company,
        callerName,
        url: `/leads?search=${encodeURIComponent(searchVal)}`
      });
    });

    // Map Calls
    calls.forEach(c => {
      const callerName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
      const company = c.company || '—';
      const searchVal = company !== '—' ? company : (callerName.split(' ')[0] || callerName);
      results.push({
        id: c._id,
        type: 'Call',
        company,
        callerName,
        url: `/calls?search=${encodeURIComponent(searchVal)}`
      });
    });

    // Map Events
    events.forEach(e => {
      const searchVal = e.companyName || e.contactPerson || '';
      results.push({
        id: e._id,
        type: 'Event',
        company: e.companyName || '—',
        callerName: e.contactPerson || '—',
        url: `/events/${e.datasetId}?search=${encodeURIComponent(searchVal)}`
      });
    });

    // Map TSS
    tss.forEach(t => {
      results.push({
        id: t._id,
        type: 'TSS',
        company: t.customerName || '—',
        callerName: t.customerName || '—',
        url: `/tss/${t.datasetId}?search=${encodeURIComponent(t.customerName || '')}`
      });
    });

    // Map CalendarEvents & Reminders
    calendarEvents.forEach(ev => {
      results.push({
        id: ev._id,
        type: ev.type === 'Reminder' ? 'Reminder' : 'Meeting',
        company: ev.title,
        callerName: `${ev.type} on ${new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` + (ev.time ? ` at ${ev.time}` : ''),
        url: '/calendar'
      });
    });

    res.json(results);
  } catch (err) {
    console.error('Global search error:', err);
    res.status(500).json({ message: 'Error performing global search' });
  }
});

// GET /api/dashboard/agent-tasks
router.get('/agent-tasks', async (req, res) => {
  try {
    const User = require('../models/User');
    const agents = await User.find({ email: { $ne: 'jayanthramnithin@gmail.com' } }).select('name email role');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const results = await Promise.all(agents.map(async (agent) => {
      const query = { assignedTo: agent._id, status: 'Open' };
      
      const todayQuery = {
        assignedTo: agent._id,
        status: 'Open',
        $or: [
          { callbackDate: { $lt: tomorrow } },
          { followUpDate: { $lt: tomorrow } }
        ]
      };

      const [leadsCount, callsCount, eventsCount, tssCount, todayLeads, todayCalls, todayEvents, todayTss] = await Promise.all([
        Lead.countDocuments(query),
        Call.countDocuments(query),
        EventRecord.countDocuments(query),
        TssRecord.countDocuments(query),
        Lead.countDocuments(todayQuery),
        Call.countDocuments(todayQuery),
        EventRecord.countDocuments(todayQuery),
        TssRecord.countDocuments(todayQuery)
      ]);
      
      return {
        _id: agent._id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        remainingTasks: leadsCount + callsCount + eventsCount + tssCount,
        todayRemaining: todayLeads + todayCalls + todayEvents + todayTss
      };
    }));
    
    results.sort((a, b) => b.remainingTasks - a.remainingTasks);
    res.json(results);
  } catch (err) {
    console.error('Error fetching agent tasks:', err);
    res.status(500).json({ message: 'Error fetching agent tasks' });
  }
});

module.exports = router;

