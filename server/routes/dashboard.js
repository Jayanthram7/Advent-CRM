const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Call = require('../models/Call');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;
    const isAgent = req.user.role === 'Agent';
    const baseQuery = isAgent ? { assignedTo: userId } : {};

    // Basic counts
    const [totalLeads, convertedLeads, openLeads] = await Promise.all([
      Lead.countDocuments(baseQuery),
      Lead.countDocuments({ ...baseQuery, isConverted: true }),
      Lead.countDocuments({ ...baseQuery, isConverted: false })
    ]);

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

    const leadsMap = new Map(leadsAggregation.map(d => [d._id, d]));
    const callsMap = new Map(callsAggregation.map(d => [d._id, d]));

    const result = [];
    let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    // Limit to prevent infinite loop or massive payload (e.g. 5 years max)
    const maxDays = 1826;
    let daysCount = 0;

    while (current <= endUTC && daysCount < maxDays) {
      const dateString = current.toISOString().split('T')[0];
      const leadData = leadsMap.get(dateString) || {};
      const callData = callsMap.get(dateString) || {};

      result.push({
        date: dateString,
        all_leads: leadData.all_leads || 0,
        converted_leads: leadData.converted_leads || 0,
        all_calls: callData.all_calls || 0,
        open_calls: callData.open_calls || 0,
        follow_up_calls: callData.follow_up_calls || 0
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

module.exports = router;

