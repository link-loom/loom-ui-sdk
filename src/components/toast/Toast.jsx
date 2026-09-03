import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircleOutline as SuccessIcon,
  WarningAmberOutlined as WarningIcon,
  ErrorOutline as ErrorIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';

// ─── Severity tokens ────────────────────────────────────────────────────────

const SEVERITY_TOKENS = {
  info: { bg: '#EFF6FF', icon: '#3B82F6', iconBg: '#DBEAFE', text: '#1E40AF' },
  warning: { bg: '#FFFBEB', icon: '#F59E0B', iconBg: '#FEF3C7', text: '#92400E' },
  error: { bg: '#FEF2F2', icon: '#EF4444', iconBg: '#FEE2E2', text: '#991B1B' },
  success: { bg: '#F0FDF4', icon: '#22C55E', iconBg: '#DCFCE7', text: '#166534' },
};

const SEVERITY_ICONS = {
  info: InfoIcon,
  warning: WarningIcon,
  error: ErrorIcon,
  success: SuccessIcon,
};

const EVENT_NAME = 'linkloom::toast';
const ACTION_EVENT_NAME = 'linkloom::toast-action';
const VIEW_ALL_EVENT_NAME = 'linkloom::toast-view-all';
const MAX_VISIBLE_CARDS = 3;

// ─── Positioning presets ────────────────────────────────────────────────────
// Each preset defines the fixed anchor insets, cross-axis alignment, the slide
// direction, and whether the newest toast renders nearest the anchored edge.
// `bottom-right` preserves the historical placement (bottom: 80, right: 20).

const POSITION_PRESETS = {
  'top-left': { anchors: { top: 20, left: 20 }, align: 'flex-start', slideFrom: 'left', newestFirst: true },
  'top-center': { anchors: { top: 20, left: '50%' }, translateX: '-50%', align: 'center', slideFrom: 'top', newestFirst: true },
  'top-right': { anchors: { top: 20, right: 20 }, align: 'flex-end', slideFrom: 'right', newestFirst: true },
  'bottom-left': { anchors: { bottom: 20, left: 20 }, align: 'flex-start', slideFrom: 'left', newestFirst: false },
  'bottom-center': { anchors: { bottom: 20, left: '50%' }, translateX: '-50%', align: 'center', slideFrom: 'bottom', newestFirst: false },
  'bottom-right': { anchors: { bottom: 80, right: 20 }, align: 'flex-end', slideFrom: 'right', newestFirst: false },
};

const DEFAULT_POSITION = 'bottom-right';

// ─── Public API (same pattern as openSnackbar) ──────────────────────────────

export const openToast = (options) => {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: options }));
};

// ─── Animation keyframes (injected once) ────────────────────────────────────

let stylesInjected = false;

function injectKeyframes() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  // `ll-toast-slide-in/out` (slide from the right) are kept as the historical
  // defaults so existing consumers that reference them keep working. The
  // directional variants let the viewport animate from whichever edge it is
  // anchored to when a non-right `position` is used.
  style.textContent = `
    @keyframes ll-toast-slide-in {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes ll-toast-slide-out {
      from { transform: translateX(0);    opacity: 1; }
      to   { transform: translateX(120%); opacity: 0; }
    }
    @keyframes ll-toast-in-right { from { transform: translateX(120%);  opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes ll-toast-in-left  { from { transform: translateX(-120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes ll-toast-in-top   { from { transform: translateY(-120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes ll-toast-in-bottom{ from { transform: translateY(120%);  opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes ll-toast-out-right { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%);  opacity: 0; } }
    @keyframes ll-toast-out-left  { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-120%); opacity: 0; } }
    @keyframes ll-toast-out-top   { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-120%); opacity: 0; } }
    @keyframes ll-toast-out-bottom{ from { transform: translateY(0); opacity: 1; } to { transform: translateY(120%);  opacity: 0; } }
  `;
  document.head.appendChild(style);
}

// ─── Single Toast Card ──────────────────────────────────────────────────────

function ToastCard({ toast, onDismiss, slideFrom = 'right' }) {
  const [exiting, setExiting] = useState(false);
  const tokens = SEVERITY_TOKENS[toast.severity] || SEVERITY_TOKENS.info;
  const IconComponent = SEVERITY_ICONS[toast.severity] || SEVERITY_ICONS.info;
  const animation = exiting
    ? `ll-toast-out-${slideFrom} 0.28s ease forwards`
    : `ll-toast-in-${slideFrom} 0.28s ease forwards`;

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.uid), 280);
  }, [onDismiss, toast.uid]);

  const handleAction = useCallback(
    (action) => {
      window.dispatchEvent(
        new CustomEvent(ACTION_EVENT_NAME, {
          detail: {
            toastId: toast.uid,
            actionId: action.id,
            actionPayload: action.payload,
          },
        })
      );
      handleDismiss();
    },
    [toast.uid, handleDismiss]
  );

  return (
    <article
      role="alert"
      style={{
        background: tokens.bg,
        borderRadius: 14,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        padding: '14px 16px',
        width: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        animation,
        pointerEvents: 'auto',
      }}
    >
      {/* Header row: icon + content + close */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon circle */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: tokens.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {toast.icon ? (
            toast.icon
          ) : (
            <IconComponent style={{ fontSize: 18, color: tokens.icon }} />
          )}
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          {toast.title && (
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                fontWeight: 600,
                color: tokens.text,
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={toast.title}
            >
              {toast.title}
            </p>
          )}
          {toast.subtitle && (
            <p
              style={{
                margin: 0,
                fontSize: '0.75rem',
                fontWeight: 400,
                color: '#6B7280',
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={toast.subtitle}
            >
              {toast.subtitle}
            </p>
          )}
        </div>

        {/* Close button */}
        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{ p: 0.25, flexShrink: 0, color: '#9CA3AF' }}
          aria-label="Dismiss notification"
        >
          <CloseIcon style={{ fontSize: 16 }} />
        </IconButton>
      </div>

      {/* Custom content slot */}
      {toast.content && <div>{toast.content}</div>}

      {/* Action buttons */}
      {toast.actions?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {toast.actions.slice(0, 2).map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAction(action)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                padding: '4px 14px',
                borderRadius: 20,
                border: `1px solid ${tokens.icon}`,
                background: 'transparent',
                color: tokens.text,
                cursor: 'pointer',
                transition: 'background 0.15s, opacity 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.iconBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {action.title}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

// ─── Toast Component (same pattern as Snackbar — mount once, no context) ────

let _toastIdCounter = 0;

export const Toast = ({
  children,
  maxVisible = 4,
  position = DEFAULT_POSITION,
  offset = {},
  zIndex = 9999,
  gap = 10,
}) => {
  const [toasts, setToasts] = useState([]);
  const timerRefs = useRef({});

  const preset = POSITION_PRESETS[position] || POSITION_PRESETS[DEFAULT_POSITION];

  useEffect(() => {
    injectKeyframes();
  }, []);

  const dismissToast = useCallback((uid) => {
    clearTimeout(timerRefs.current[uid]);
    delete timerRefs.current[uid];
    setToasts((prev) => prev.filter((t) => t.uid !== uid));
  }, []);

  const handleToastEvent = useCallback(
    (event) => {
      const detail = event.detail;
      if (!detail) return;

      const uid = `toast-${++_toastIdCounter}-${Date.now()}`;
      const newToast = {
        uid,
        severity: detail.severity || 'info',
        title: detail.title || '',
        subtitle: detail.subtitle || '',
        icon: detail.icon || null,
        actions: detail.actions || [],
        content: detail.content || null,
        duration: detail.duration !== undefined ? detail.duration : 6000,
        meta: detail.meta || {},
        renderCard: detail.renderCard || null,
      };

      setToasts((prev) => {
        const next = prev.length >= maxVisible ? prev.slice(1) : prev;
        return [...next, newToast];
      });

      if (newToast.duration !== null && newToast.duration > 0) {
        timerRefs.current[uid] = setTimeout(
          () => dismissToast(uid),
          newToast.duration
        );
      }
    },
    [maxVisible, dismissToast]
  );

  useEffect(() => {
    window.addEventListener(EVENT_NAME, handleToastEvent);
    return () => window.removeEventListener(EVENT_NAME, handleToastEvent);
  }, [handleToastEvent]);

  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      {children}
      {toasts.length > 0 && (
        <div
          role="region"
          aria-label="Notifications"
          style={{
            position: 'fixed',
            zIndex,
            display: 'flex',
            flexDirection: 'column',
            alignItems: preset.align,
            gap,
            pointerEvents: 'none',
            ...preset.anchors,
            ...offset,
            ...(preset.translateX ? { transform: `translateX(${preset.translateX})` } : {}),
          }}
        >
          {(preset.newestFirst
            ? [...toasts.slice(-MAX_VISIBLE_CARDS)].reverse()
            : toasts.slice(-MAX_VISIBLE_CARDS)
          ).map((toast) =>
            toast.renderCard ? (
              <div key={toast.uid} style={{ pointerEvents: 'auto' }}>
                {toast.renderCard(() => dismissToast(toast.uid))}
              </div>
            ) : (
              <ToastCard
                key={toast.uid}
                toast={toast}
                onDismiss={dismissToast}
                slideFrom={preset.slideFrom}
              />
            )
          )}

          {toasts.length > 1 && (
            <div style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  toasts.forEach((t) => dismissToast(t.uid));
                }}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '6px 20px',
                  borderRadius: 20,
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(4px)',
                  color: '#374151',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                  transition: 'background 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; }}
              >
                Hide all
              </button>
              {toasts.length > MAX_VISIBLE_CARDS && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent(VIEW_ALL_EVENT_NAME, { detail: { count: toasts.length } })
                    );
                    toasts.forEach((t) => dismissToast(t.uid));
                  }}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '6px 20px',
                    borderRadius: 20,
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(4px)',
                    color: '#374151',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                    transition: 'background 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; }}
                >
                  See all {toasts.length} tasks →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Toast;
