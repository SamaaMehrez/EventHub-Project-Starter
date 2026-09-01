import { useEffect, useMemo, useState } from 'react';
import { api, decodeToken } from './api';
import Dashboard from './Dashboard';
import './styles.css';

const CATEGORIES = [
  'All events',
  'Technology',
  'Career',
  'Music',
  'Education',
];

const categoryFor = (title) => {
  const t = title.toLowerCase();

  if (t.includes('career')) return 'Career';
  if (t.includes('concert')) return 'Music';
  if (t.includes('distributed') || t.includes('tech')) return 'Technology';

  return 'Education';
};

const gradients = ['sunset', 'ocean', 'violet', 'mint'];

const SENTIMENT_COLORS = {
  positive: '#1D9E75',
  neutral: '#888780',
  negative: '#D85A30',
};

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('eventhub_token');
    const payload = token ? decodeToken(token) : null;

    return payload
      ? {
          id: payload.sub,
          email: payload.email,
        }
      : null;
  });

  const [page, setPage] = useState('discover');
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All events');
  const [selected, setSelected] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const notify = (message, type = 'success') => {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 3600);
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      setEvents(await api.catalog());
    } catch (e) {
      notify(`Could not load events: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    if (!user) return;

    try {
      const [b, r] = await Promise.all([
        api.bookings(),
        api.reviews(),
      ]);

      setBookings(
        b.filter(
          (x) => String(x.userId) === String(user.id)
        )
      );

      setReviews(r);
    } catch (e) {
      notify(
        `Could not load your activity: ${e.message}`,
        'error'
      );
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    loadUserData();
  }, [user]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchesQuery = e.title
        .toLowerCase()
        .includes(query.toLowerCase());

      const matchesCategory =
        category === 'All events' ||
        categoryFor(e.title) === category;

      return matchesQuery && matchesCategory;
    });
  }, [events, query, category]);

  const eventMap = useMemo(
    () =>
      Object.fromEntries(
        events.map((e) => [String(e.id), e])
      ),
    [events]
  );

  const bookedIds = useMemo(
    () =>
      new Set(
        bookings.map((b) => String(b.eventId))
      ),
    [bookings]
  );

  const handleAuth = async (
    mode,
    email,
    password
  ) => {
    try {
      if (mode === 'register') {
        await api.register(email, password);
        notify('Account created. Signing you in…');
      }

      const result = await api.login(
        email,
        password
      );

      localStorage.setItem(
        'eventhub_token',
        result.token
      );

      const payload = decodeToken(result.token);

      setUser({
        id: payload.sub,
        email: payload.email,
      });

      setAuthMode(null);

      notify(
        mode === 'register'
          ? 'Welcome to EventHub!'
          : 'Welcome back!'
      );
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  const handleBook = async (event) => {
    if (!user) {
      setAuthMode('login');
      notify(
        'Sign in to reserve your seat.',
        'info'
      );
      return;
    }

    if (bookedIds.has(String(event.id))) {
      notify(
        'You already booked this event.',
        'info'
      );
      return;
    }

    try {
      const booking = await api.book(
        user.id,
        event.id
      );

      setBookings((prev) => [
        ...prev,
        booking,
      ]);

      setSelected(null);

      notify(
        'Seat reserved! Your booking is confirmed.'
      );
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  const logout = () => {
    localStorage.removeItem('eventhub_token');

    setUser(null);
    setBookings([]);
    setReviews([]);
    setPage('discover');

    notify(
      'You have been signed out.',
      'info'
    );
  };

  return (
    <div className="app-shell">

      <header className="topbar">

        <button
          className="brand"
          onClick={() => setPage('discover')}
        >
          <span className="brand-mark">✦</span>

          <span>
            Event<span>Hub</span>
          </span>
        </button>

        <nav>

          <button
            className={
              page === 'discover'
                ? 'nav-active'
                : ''
            }
            onClick={() =>
              setPage('discover')
            }
          >
            Discover
          </button>

          {user && (
            <button
              className={
                page === 'bookings'
                  ? 'nav-active'
                  : ''
              }
              onClick={() =>
                setPage('bookings')
              }
            >
              My bookings
            </button>
          )}

          {user && (
            <button
              className={
                page === 'insights'
                  ? 'nav-active'
                  : ''
              }
              onClick={() =>
                setPage('insights')
              }
            >
              Insights
            </button>
          )}

        </nav>

        <div className="top-actions">

          {user ? (
            <div className="user-menu">

              <span className="avatar">
                {user.email[0].toUpperCase()}
              </span>

              <span className="user-email">
                {user.email}
              </span>

              <button
                className="ghost-btn"
                onClick={logout}
              >
                Log out
              </button>

            </div>
          ) : (
            <>
              <button
                className="ghost-btn"
                onClick={() =>
                  setAuthMode('login')
                }
              >
                Log in
              </button>

              <button
                className="primary-btn small"
                onClick={() =>
                  setAuthMode('register')
                }
              >
                Create account
              </button>
            </>
          )}

        </div>

      </header>

      {page === 'discover' && (
        <main>

          <section className="hero">

            <div className="hero-copy">

              <div className="eyebrow">
                <span>✦</span>
                Discover what's happening
              </div>

              <h1>
                Make plans.
                <br />
                <em>Make memories.</em>
              </h1>

              <p>
                Find inspiring events, reserve your spot,
                and turn an ordinary day into something
                worth remembering.
              </p>

              <div className="hero-search">

                <span>⌕</span>

                <input
                  value={query}
                  onChange={(e) =>
                    setQuery(e.target.value)
                  }
                  placeholder="Search events, topics, or experiences…"
                />

                <button
                  onClick={() =>
                    document
                      .getElementById('events')
                      ?.scrollIntoView({
                        behavior: 'smooth',
                      })
                  }
                >
                  Explore
                </button>

              </div>

              <div className="hero-meta">
                <span>◉ Curated events</span>
                <span>⚡ Instant booking</span>
                <span>★ Smart reviews</span>
              </div>

            </div>

            <div className="hero-art">

              <div className="orb orb-one" />
              <div className="orb orb-two" />

              <div className="floating-card card-a">
                <span>✦</span>

                <div>
                  <b>4.9/5</b>
                  <small>Event experience</small>
                </div>
              </div>

              <div className="floating-card card-b">
                <b>1,240+</b>
                <small>people exploring</small>
              </div>

              <div className="ticket">

                <div className="ticket-top">
                  <span>EVENTHUB</span>
                  <span>08 / 26</span>
                </div>

                <strong>
                  Ideas worth
                  <br />
                  showing up for.
                </strong>

                <div className="ticket-line" />

                <div className="ticket-bottom">
                  <span>
                    YOUR NEXT EXPERIENCE
                  </span>
                  <span>✦</span>
                </div>

              </div>

            </div>

          </section>

          <section
            className="content"
            id="events"
          >

            <div className="section-heading">

              <div>
                <span className="eyebrow">
                  EXPLORE
                </span>

                <h2>
                  Find your next event
                </h2>
              </div>

              <span className="event-count">
                {filtered.length} events
              </span>

            </div>

            <div className="filters">

              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={
                    category === c
                      ? 'filter active'
                      : 'filter'
                  }
                  onClick={() =>
                    setCategory(c)
                  }
                >
                  {c}
                </button>
              ))}

            </div>

            {loading ? (
              <div className="loading-grid">

                {[1, 2, 3, 4].map((i) => (
                  <div
                    className="skeleton"
                    key={i}
                  />
                ))}

              </div>
            ) : filtered.length ? (
              <div className="event-grid">

                {filtered.map((event, i) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    index={i}
                    booked={bookedIds.has(
                      String(event.id)
                    )}
                    onOpen={() =>
                      setSelected(event)
                    }
                  />
                ))}

              </div>
            ) : (
              <div className="empty">

                <div>⌕</div>

                <h3>
                  No events found
                </h3>

                <p>
                  Try another search or category.
                </p>

              </div>
            )}

          </section>

          <section className="why content">

            <div className="eyebrow">
              WHY EVENTHUB
            </div>

            <h2>
              Everything you need to{' '}
              <em>show up.</em>
            </h2>

            <div className="feature-grid">

              <Feature
                icon="◈"
                title="Discover"
                text="A clean, curated catalog of experiences made to be found."
              />

              <Feature
                icon="↗"
                title="Book instantly"
                text="Reserve a seat in seconds with a simple, reliable flow."
              />

              <Feature
                icon="✦"
                title="Share your take"
                text="Leave a review and let AI turn feedback into useful insight."
              />

            </div>

          </section>

        </main>
      )}

      {page === 'bookings' && (
        <Bookings
          bookings={bookings}
          eventMap={eventMap}
          reviews={reviews}
          onReview={async (id, text) => {
            try {
              const r = await api.review(
                id,
                text
              );

              setReviews((x) => [
                ...x,
                r,
              ]);

              notify(
                'Review submitted — thanks!'
              );
            } catch (e) {
              notify(
                e.message,
                'error'
              );
            }
          }}
        />
      )}

      {page === 'insights' && <Dashboard />}

      {selected && (
        <EventModal
          event={selected}
          booked={bookedIds.has(
            String(selected.id)
          )}
          onClose={() =>
            setSelected(null)
          }
          onBook={() =>
            handleBook(selected)
          }
        />
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() =>
            setAuthMode(null)
          }
          onSubmit={handleAuth}
        />
      )}

      {toast && (
        <div
          className={`toast ${toast.type}`}
        >
          <span>
            {toast.type === 'error'
              ? '!'
              : toast.type === 'info'
              ? 'i'
              : '✓'}
          </span>

          {toast.message}
        </div>
      )}

      <footer>

        <div className="brand footer-brand">
          <span className="brand-mark">
            ✦
          </span>

          <span>
            Event<span>Hub</span>
          </span>
        </div>

        <span>
          Built for people who would rather be there.
        </span>

        <span>
          © 2026 EventHub
        </span>

      </footer>

    </div>
  );
}

function EventCard({
  event,
  index,
  booked,
  onOpen,
}) {
  return (
    <article
      className="event-card"
      onClick={onOpen}
    >

      <div
        className={`event-visual ${
          gradients[index % gradients.length]
        }`}
      >

        <span className="event-number">
          0{index + 1}
        </span>

        <span className="visual-symbol">
          {['◌', '✦', '◈', '♪'][
            index % 4
          ]}
        </span>

        <span className="category-pill">
          {categoryFor(event.title)}
        </span>

      </div>

      <div className="event-info">

        <div className="event-title-row">

          <h3>{event.title}</h3>

          <span className="price">
            {Number(event.price) === 0
              ? 'Free'
              : `$${Number(event.price).toFixed(
                  0
                )}`}
          </span>

        </div>

        <p className="event-details">
          {
            [
              'Sat · 10:00 AM',
              'Tue · 6:30 PM',
              'Thu · 5:00 PM',
              'Fri · 8:00 PM',
            ][index % 4]
          }

          <span>•</span>

          Cairo
        </p>

        <div className="card-bottom">

          <span>
            Open event details
          </span>

          {booked ? (
            <span className="confirmed">
              ✓ Booked
            </span>
          ) : (
            <span className="arrow">
              ↗
            </span>
          )}

        </div>

      </div>

    </article>
  );
}

function Feature({
  icon,
  title,
  text,
}) {
  return (
    <div className="feature">

      <div className="feature-icon">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{text}</p>

    </div>
  );
}

function EventModal({
  event,
  booked,
  onClose,
  onBook,
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >

      <div
        className="modal event-modal"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        <button
          className="close"
          onClick={onClose}
        >
          ×
        </button>

        <div
          className={`modal-art ${
            gradients[
              event.id % gradients.length
            ]
          }`}
        >

          <span>
            {categoryFor(event.title)}
          </span>

          <strong>
            {event.title}
          </strong>

        </div>

        <div className="modal-body">

          <div className="modal-title">

            <div>
              <span className="eyebrow">
                EVENT DETAILS
              </span>

              <h2>
                {event.title}
              </h2>
            </div>

            <strong className="modal-price">
              {Number(event.price) === 0
                ? 'Free'
                : `$${Number(
                    event.price
                  ).toFixed(2)}`}
            </strong>

          </div>

          <div className="detail-row">

            <div>
              <small>DATE</small>
              <b>August 2026</b>
            </div>

            <div>
              <small>TIME</small>
              <b>6:30 PM</b>
            </div>

            <div>
              <small>LOCATION</small>
              <b>Cairo, Egypt</b>
            </div>

          </div>

          <p className="modal-description">
            Join a community of curious people
            for an engaging EventHub experience.
            Your booking is confirmed instantly
            and saved to your account.
          </p>

          <button
            className="primary-btn wide"
            onClick={onBook}
            disabled={booked}
          >
            {booked
              ? '✓ Already booked'
              : Number(event.price) === 0
              ? 'Reserve free seat'
              : 'Reserve my seat'}
          </button>

        </div>

      </div>

    </div>
  );
}

function AuthModal({
  mode,
  onModeChange,
  onClose,
  onSubmit,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] =
    useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);

    await onSubmit(
      mode,
      email,
      password
    );

    setBusy(false);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >

      <div
        className="modal auth-modal"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        <button
          className="close"
          onClick={onClose}
        >
          ×
        </button>

        <div className="auth-side">

          <span className="big-star">
            ✦
          </span>

          <h2>
            {mode === 'login'
              ? 'Welcome back.'
              : 'Your next experience starts here.'}
          </h2>

          <p>
            {mode === 'login'
              ? 'Pick up where you left off and discover something new.'
              : 'Create an account to book events and keep every experience in one place.'}
          </p>

        </div>

        <form
          onSubmit={submit}
          className="auth-form"
        >

          <span className="eyebrow">
            EVENTHUB ACCOUNT
          </span>

          <h2>
            {mode === 'login'
              ? 'Sign in'
              : 'Create account'}
          </h2>

          <label>
            Email

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              minLength="6"
              placeholder="••••••••"
            />
          </label>

          <button
            className="primary-btn wide"
            disabled={busy}
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
          </button>

          <p className="switch-auth">

            {mode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}

            {' '}

            <button
              type="button"
              onClick={() =>
                onModeChange(
                  mode === 'login'
                    ? 'register'
                    : 'login'
                )
              }
            >
              {mode === 'login'
                ? 'Create one'
                : 'Sign in'}
            </button>

          </p>

        </form>

      </div>

    </div>
  );
}

function Bookings({
  bookings,
  eventMap,
  reviews,
  onReview,
}) {
  const [active, setActive] =
    useState(null);

  const [text, setText] =
    useState('');

  return (
    <main className="page content">

      <div className="page-heading">

        <div>

          <span className="eyebrow">
            YOUR SPACE
          </span>

          <h1>
            My bookings
          </h1>

          <p>
            Keep track of the experiences
            you chose to show up for.
          </p>

        </div>

        <div className="stat-chip">

          <b>{bookings.length}</b>

          <span>
            reserved
          </span>

        </div>

      </div>

      {bookings.length === 0 ? (
        <div className="empty large">

          <div>✦</div>

          <h3>
            Your calendar is waiting
          </h3>

          <p>
            Explore events and reserve
            your first experience.
          </p>

        </div>
      ) : (
        <div className="booking-list">

          {bookings.map((b) => {

            const event =
              eventMap[
                String(b.eventId)
              ] || {
                title: `Event #${b.eventId}`,
                price: 0,
              };

            const reviewed =
              reviews.some(
                (r) =>
                  r.bookingId === b.id
              );

            return (
              <div
                className="booking-card"
                key={b.id}
              >

                <div
                  className={`booking-art ${
                    gradients[
                      b.eventId % 4
                    ]
                  }`}
                >
                  <span>✦</span>
                </div>

                <div className="booking-main">

                  <div>

                    <span className="eyebrow">
                      CONFIRMED
                    </span>

                    <h3>
                      {event.title}
                    </h3>

                    <p>
                      Booking ID ·{' '}
                      {b.id.slice(0, 8)}
                      …
                    </p>

                  </div>

                  <span className="status">
                    ✓ Confirmed
                  </span>

                </div>

                <div className="booking-action">

                  {reviewed ? (
                    <span className="reviewed">
                      ★ Reviewed
                    </span>
                  ) : active === b.id ? (
                    <div className="review-box">

                      <textarea
                        value={text}
                        onChange={(e) =>
                          setText(
                            e.target.value
                          )
                        }
                        placeholder="How was the experience?"
                        rows="3"
                      />

                      <div>

                        <button
                          className="ghost-btn"
                          onClick={() => {
                            setActive(null);
                            setText('');
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          className="primary-btn small"
                          disabled={
                            !text.trim()
                          }
                          onClick={() => {
                            onReview(
                              b.id,
                              text
                            );

                            setActive(null);
                            setText('');
                          }}
                        >
                          Send review
                        </button>

                      </div>

                    </div>
                  ) : (
                    <button
                      className="outline-btn"
                      onClick={() =>
                        setActive(b.id)
                      }
                    >
                      Leave a review
                    </button>
                  )}

                </div>

              </div>
            );
          })}

        </div>
      )}

    </main>
  );
}


export default App;