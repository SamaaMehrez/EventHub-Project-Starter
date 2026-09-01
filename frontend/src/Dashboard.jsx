import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import { api } from './api';

const SENTIMENT_COLORS = {
  positive: '#1D9E75',
  neutral: '#888780',
  negative: '#D85A30',
};

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('bookingsCount');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    api.analyticsSummary()
      .then(setSnapshot)
      .catch((err) => setError(err.message));
  }, []);

  const rows = useMemo(() => {
    if (!snapshot) return [];

    const filtered = snapshot.eventsTable.filter((row) =>
      row.title.toLowerCase().includes(search.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;

      return a[sortKey] > b[sortKey]
        ? dir
        : a[sortKey] < b[sortKey]
          ? -dir
          : 0;
    });
  }, [snapshot, search, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((current) =>
        current === 'asc' ? 'desc' : 'asc'
      );
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (error) {
    return (
      <main className="page content">
        <div className="loading-panel analytics-error">
          Failed to load analytics: {error}
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="page content">
        <div className="loading-panel">
          Loading insights…
        </div>
      </main>
    );
  }

  const totalBookings = snapshot.eventsTable.reduce(
    (sum, event) => sum + Number(event.bookingsCount || 0),
    0
  );

  const totalRevenue = snapshot.eventsTable.reduce(
    (sum, event) => sum + Number(event.revenue || 0),
    0
  );

  const totalReviews = snapshot.eventsTable.reduce(
    (sum, event) => sum + Number(event.reviewCount || 0),
    0
  );

  const positiveReviews =
    Number(snapshot.sentimentTotals?.positive || 0);

  const sentimentData = Object.entries(
    snapshot.sentimentTotals || {}
  ).map(([name, value]) => ({
    name,
    value,
  }));

  const columns = [
    ['title', 'Event'],
    ['bookingsCount', 'Bookings'],
    ['revenue', 'Revenue'],
    ['reviewCount', 'Reviews'],
    ['avgSentimentScore', 'Avg sentiment'],
  ];

  return (
    <main className="page content dashboard-page">

      {/* HEADER */}
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">OVERVIEW</span>

          <h1>Event insights</h1>

          <p>
            A snapshot generated from the activity in your
            EventHub services.
          </p>
        </div>

        <span className="generated">
          Updated{' '}
          {new Date(snapshot.generatedAt).toLocaleString()}
        </span>
      </div>

      {/* STATISTICS */}
      <div className="metric-grid">

        <div className="metric">
          <span>Total bookings</span>
          <b>{totalBookings}</b>
          <i>↗</i>
        </div>

        <div className="metric">
          <span>Revenue</span>
          <b>${totalRevenue.toFixed(0)}</b>
          <i>↗</i>
        </div>

        <div className="metric">
          <span>Reviews</span>
          <b>{totalReviews}</b>
          <i>↗</i>
        </div>

        <div className="metric">
          <span>Positive reviews</span>
          <b>{positiveReviews}</b>
          <i>↗</i>
        </div>

      </div>

      {/* CHARTS */}
      <div className="analytics-chart-grid">

        {/* BOOKINGS CHART */}
        <section className="panel analytics-chart-panel">

          <div className="panel-heading">
            <div>
              <h3>Bookings over time</h3>
              <span>Last 14 days</span>
            </div>
          </div>

          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={snapshot.bookingsTimeseries}
                margin={{
                  top: 10,
                  right: 20,
                  left: 0,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="#378ADD"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </section>

        {/* SENTIMENT CHART */}
        <section className="panel analytics-chart-panel">

          <div className="panel-heading">
            <div>
              <h3>Review sentiment</h3>
              <span>Overall review distribution</span>
            </div>
          </div>

          <div className="analytics-pie">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>

                <Pie
                  data={sentimentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {sentimentData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        SENTIMENT_COLORS[entry.name] ||
                        '#888780'
                      }
                    />
                  ))}
                </Pie>

                <Tooltip />

                <Legend />

              </PieChart>
            </ResponsiveContainer>
          </div>

        </section>

      </div>

      {/* SORTABLE EVENTS TABLE */}
      <section className="panel dashboard-table-panel">

        <div className="panel-heading">
          <div>
            <h3>Detailed event statistics</h3>
            <span>
              Click a column to sort
            </span>
          </div>
        </div>

        <div className="dashboard-table-wrapper">

          <table className="dashboard-table">

            <thead>
              <tr>

                {columns.map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() =>
                      toggleSort(key)
                    }
                  >
                    {label}

                    {sortKey === key && (
                      <span className="sort-arrow">
                        {sortDir === 'asc'
                          ? ' ↑'
                          : ' ↓'}
                      </span>
                    )}
                  </th>
                ))}

              </tr>
            </thead>

            <tbody>

              {rows.map((row) => (
                <tr key={row.eventId}>

                  <td>
                    <strong>
                      {row.title}
                    </strong>
                  </td>

                  <td>
                    {row.bookingsCount}
                  </td>

                  <td>
                    ${Number(row.revenue).toFixed(0)}
                  </td>

                  <td>
                    {row.reviewCount}
                  </td>

                  <td>
                    {Number(
                      row.avgSentimentScore || 0
                    ).toFixed(2)}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </section>

    </main>
  );
}