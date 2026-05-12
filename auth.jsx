/* global React */

const {
  useState: _useState,
  useEffect: _useEffect,
  useCallback: _useCallback
} = React;

const SUPABASE_URL =
  "https://hordrkpxsfcnvfjbzzdb.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_v37mf5VzanKEEKB9RbxMMA_qvZQaUFZ";

const SESSION_KEY = "ph_admin_session_v1";

const ALLOWED_EMAILS = Object.freeze([
  "ssjshantan@gmail.com",
  "nandiniananthabotla@gmail.com",
]);

window.ALLOWED_EMAILS = ALLOWED_EMAILS;

async function getAdminCreds() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_auth?select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();

    if (!data || !data.length) {
      return null;
    }

    return data[0];
  } catch (err) {
    console.error(err);
    return null;
  }
}

window.useAdminAuth = function () {
  const [isAdmin, setIsAdmin] = _useState(false);
  const [ready, setReady] = _useState(false);

  _useEffect(() => {
    try {
      const s = JSON.parse(
        localStorage.getItem(SESSION_KEY) || "null"
      );

      if (
        s &&
        s.loggedIn &&
        (!s.expires || s.expires > Date.now())
      ) {
        setIsAdmin(true);
      }
    } catch {}

    setReady(true);
  }, []);

  const login = _useCallback(async (userId, password) => {
    const creds = await getAdminCreds();

    if (!creds) {
      return {
        ok: false,
        error: "Unable to load admin credentials",
      };
    }

    if (
      userId === creds.user_id &&
      password === creds.password_hash
    ) {
      const session = {
        loggedIn: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      };

      try {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify(session)
        );
      } catch {}

      setIsAdmin(true);

      return { ok: true };
    }

    return {
      ok: false,
      error: "Invalid credentials",
    };
  }, []);

  const logout = _useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}

    setIsAdmin(false);
  }, []);

  const changePassword = _useCallback(
    async (current, next) => {
      const creds = await getAdminCreds();

      if (!creds) {
        return {
          ok: false,
          error: "Unable to load credentials",
        };
      }

      if (current !== creds.password_hash) {
        return {
          ok: false,
          error: "Current password incorrect",
        };
      }

      if (!next || next.length < 4) {
        return {
          ok: false,
          error:
            "New password must be at least 4 characters",
        };
      }

      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/admin_auth?id=eq.${creds.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              password_hash: next,
            }),
          }
        );

        if (!res.ok) {
          return {
            ok: false,
            error: "Failed to update password",
          };
        }

        return { ok: true };
      } catch (err) {
        console.error(err);

        return {
          ok: false,
          error: "Something went wrong",
        };
      }
    },
    []
  );

  return {
    isAdmin,
    ready,
    login,
    logout,
    changePassword,
  };
};

// ---------- UI ----------

window.AdminBadge = function AdminBadge({
  auth,
  onOpenLogin,
  onOpenManage,
}) {
  if (!auth.ready) return null;

  if (!auth.isAdmin) {
    return (
      <button
        className="admin-badge"
        onClick={onOpenLogin}
        title="Admin login"
      >
        🔐 ADMIN
      </button>
    );
  }

  return (
    <div
      className="admin-badge on"
      onClick={onOpenManage}
    >
      <span className="dot"></span> ADMIN
    </div>
  );
};

window.LoginModal = function LoginModal({
  open,
  onClose,
  auth,
}) {
  const [userId, setUserId] = _useState("");
  const [pass, setPass] = _useState("");
  const [err, setErr] = _useState("");
  const [busy, setBusy] = _useState(false);

  _useEffect(() => {
    if (!open) {
      setUserId("");
      setPass("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setErr("");

    const r = await auth.login(
      userId.trim(),
      pass
    );

    setBusy(false);

    if (!r.ok) setErr(r.error);
    else onClose();
  };

  return (
    <div className="ab-back" onClick={onClose}>
      <form
        className="ab-modal auth-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="ab-hdr">
          <h2>🔐 ADMIN LOGIN</h2>

          <button
            type="button"
            className="ab-x"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="ab-body">
          <div className="auth-note">
            Restricted Admin Access
          </div>

          <label className="ab-row">
            <span>User ID</span>

            <input
              value={userId}
              onChange={(e) =>
                setUserId(e.target.value)
              }
              autoFocus
              required
            />
          </label>

          <label className="ab-row">
            <span>Password</span>

            <input
              type="password"
              value={pass}
              onChange={(e) =>
                setPass(e.target.value)
              }
              required
            />
          </label>

          {err && (
            <div className="auth-err">
              ⚠ {err}
            </div>
          )}
        </div>

        <div className="ab-foot">
          <button
            type="button"
            className="ab-btn ghost"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="ab-btn primary"
            disabled={busy}
          >
            {busy ? "Checking…" : "✦ Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
};

window.ManageModal = function ManageModal({
  open,
  onClose,
  auth,
}) {
  const [cur, setCur] = _useState("");
  const [next1, setNext1] = _useState("");
  const [next2, setNext2] = _useState("");
  const [msg, setMsg] = _useState("");
  const [err, setErr] = _useState("");

  _useEffect(() => {
    if (!open) {
      setCur("");
      setNext1("");
      setNext2("");
      setMsg("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const submitChange = async (e) => {
    e.preventDefault();

    setErr("");
    setMsg("");

    if (next1 !== next2) {
      setErr("New passwords don't match");
      return;
    }

    const r = await auth.changePassword(
      cur,
      next1
    );

    if (!r.ok) {
      setErr(r.error);
    } else {
      setMsg("✓ Password updated.");
      setCur("");
      setNext1("");
      setNext2("");
    }
  };

  return (
    <div className="ab-back" onClick={onClose}>
      <div
        className="ab-modal auth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ab-hdr">
          <h2>⚙ ADMIN PANEL</h2>

          <button
            type="button"
            className="ab-x"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form
          className="ab-body"
          onSubmit={submitChange}
        >
          <label className="ab-row">
            <span>Current password</span>

            <input
              type="password"
              value={cur}
              onChange={(e) =>
                setCur(e.target.value)
              }
              required
            />
          </label>

          <label className="ab-row">
            <span>New password</span>

            <input
              type="password"
              value={next1}
              onChange={(e) =>
                setNext1(e.target.value)
              }
              required
              minLength={4}
            />
          </label>

          <label className="ab-row">
            <span>Confirm new password</span>

            <input
              type="password"
              value={next2}
              onChange={(e) =>
                setNext2(e.target.value)
              }
              required
              minLength={4}
            />
          </label>

          {err && (
            <div className="auth-err">
              ⚠ {err}
            </div>
          )}

          {msg && (
            <div className="auth-ok">
              {msg}
            </div>
          )}

          <div className="ab-foot inline">
            <button
              type="button"
              className="ab-btn ghost"
              onClick={() =>
                auth.logout() || onClose()
              }
            >
              Sign out
            </button>

            <button
              type="submit"
              className="ab-btn primary"
            >
              Update password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};