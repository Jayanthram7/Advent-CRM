const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
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

module.exports = router;
