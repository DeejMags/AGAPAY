import React from 'react';
import authFetch from '../utils/authFetch';

export default function Report() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [lastUpdated, setLastUpdated] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await authFetch('/api/reports');
      if (!res.ok) {
        let msg = 'Failed to load reports';
        try { msg = `${res.status}: ${await res.text()}`; } catch {}
        throw new Error(msg);
      }
      const json = await res.json();
      const arr = Array.isArray(json) ? json : (json.items || []);
      setItems(arr);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message || 'Load failed');
    } finally { setLoading(false); }
  }

  React.useEffect(() => { load(); }, []);

  // Auto refresh when tab becomes visible, when other parts of the app change reports, and every 45s as a fallback
  React.useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    const onChanged = () => load();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('reports-changed', onChanged);
    const id = window.setInterval(load, 45000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('reports-changed', onChanged);
      window.clearInterval(id);
    };
  }, []);

  async function setStatus(id, status) {
    try {
      setBusyId(id);
      const res = await authFetch(`/api/reports/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) {
        const txt = await res.text().catch(()=> '');
        throw new Error(txt || 'Update failed');
      }
      await load();
      // notify dashboard to refresh badges/cards
      window.dispatchEvent(new Event('reports-changed'));
    } catch (e) {
      setError(e.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  }
 

  async function handleDelete(id) {
    try {
      if (!window.confirm('Delete this report? This action cannot be undone.')) return;
      setBusyId(id);
      const res = await authFetch(`/api/reports/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const txt = await res.text().catch(()=> '');
        throw new Error(txt || 'Delete failed');
      }
      setItems(prev => prev.filter(i => i.id !== id));
      // notify dashboard to refresh badges/cards
      window.dispatchEvent(new Event('reports-changed'));
    } catch (e) {
      setError(e.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Reports</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && <div className="text-xs text-gray-500">Updated {lastUpdated.toLocaleTimeString()}</div>}
          <button className="px-3 py-2 rounded bg-teal-600 text-white" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow mb-8">
          <table className="min-w-[700px] w-full table-auto">
            <thead>
              <tr className="bg-teal-100 text-teal-700">
                <th className="p-3 text-left">Reporter</th>
                <th className="p-3 text-left">Reported user</th>
                <th className="p-3 text-left">Reason</th>
                <th className="p-3 text-left">Details</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(m => {
                const statusStr = String(m.status || 'open').toLowerCase();
                const isResolved = statusStr === 'resolved';
                return (
                  <tr key={m.id} className="border-b align-top">
                    <td className="p-3 text-sm">
                      <div className="font-medium">{m.reporterName || m.reporterEmail || m.reporterId || 'Unknown'}</div>
                      {m.reporterEmail && <div className="text-gray-500">{m.reporterEmail}</div>}
                    </td>
                    <td className="p-3 text-sm">
                      <div className="font-medium">{m.reportedUserName || m.reportedUserEmail || m.reportedUserId || 'Unknown'}</div>
                      {m.reportedUserEmail && <div className="text-gray-500">{m.reportedUserEmail}</div>}
                    </td>
                    <td className="p-3">{m.reason || '—'}</td>
                    <td className="p-3 max-w-xs break-words whitespace-pre-wrap">{m.details || '—'}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${isResolved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {m.status || 'open'}
                      </span>
                    </td>
                    <td className="p-3 space-x-2 whitespace-nowrap">
                      {isResolved ? (
                        <span className="text-gray-400 text-sm">No actions</span>
                      ) : (
                        <>
                          <button className="px-2 py-1 bg-green-200 rounded disabled:opacity-50" disabled={busyId===m.id} onClick={()=>setStatus(m.id, 'resolved')}>Resolved</button>
                          <button className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50" disabled={busyId===m.id} onClick={()=>handleDelete(m.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
