import React, { useEffect, useState } from "react";
import api from "../../../services/api";
import "./AdminDashboard.css";

const n = (v) => (isNaN(Number(v)) ? 0 : Number(v));

const brCurrency = (v) =>
  n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const asArray = (v) => (Array.isArray(v) ? v : []);

const isTripFinished = (trip) => {
  return (
    trip.finalizado === true ||
    trip.finished === true ||
    trip.status === "finalizado"
  );
};

const getSaldoAReceber = (trip) => {
  const trechos = asArray(trip.trechos);

  return trechos.reduce((s, r) => s + n(r.saldo), 0);
};

export default function AdminDashboard() {
  const [me, setMe] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [totalUsers, setTotalUsers] = useState(0);
  const [totalOpenTrips, setTotalOpenTrips] = useState(0);
  const [totalSaldoAReceber, setTotalSaldoAReceber] = useState(0);

  const [latest, setLatest] = useState([]);

  const roleLabel = {
    driver: "Motorista",
    admin: "Administrador",
  };

  const formatDateTime = (v) => {
    if (!v) return "-";
    try {
      return new Date(v).toLocaleString("pt-BR");
    } catch {
      return "-";
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setErr("");

    try {
      const meResp = await api.get("/auth/me");
      setMe(meResp?.data?.user || null);

      const [all, latestResp, tripsResp] = await Promise.all([
        api.get("/admin/users", { params: { limit: 1 } }),
        api.get("/admin/users", { params: { limit: 5 } }),
        api.get("/admin/trips", { params: { limit: 1000 } }),
      ]);

      const trips = tripsResp?.data?.items || [];

      const openTrips = trips.filter((trip) => !isTripFinished(trip));

      const saldoAReceber = openTrips.reduce(
        (s, trip) => s + getSaldoAReceber(trip),
        0
      );

      setTotalUsers(all?.data?.total ?? 0);
      setTotalOpenTrips(openTrips.length);
      setTotalSaldoAReceber(saldoAReceber);
      setLatest(latestResp?.data?.items || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <div className="admin-page">
      <div className="card admin-main-card">
        <div className="card-head row">
          <div>
            <h2>Visão geral</h2>
            <p className="muted">
              {me ? (
                <>
                  • Bem-vindo, <strong>{me.name}</strong> — perfil{" "}
                  <b>{me.role}</b>.
                </>
              ) : (
                <>• Bem-vindo ao painel administrativo.</>
              )}
            </p>
          </div>
          <div className="row gap">
            <button
              className="btn btn-primary dashboard-refresh-btn"
              type="button"
              onClick={fetchAll}
              disabled={loading}
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        {err && (
          <div className="alert error-alert" style={{ marginBottom: 12 }}>
            {err}
          </div>
        )}

        {/* KPIs */}
        <div className="dashboard-grid">
          <div className="dashboard-stat">
            <div className="dashboard-stat-label">
              Viagens não finalizadas
            </div>
            <div className="dashboard-stat-num">
              {loading ? "—" : totalOpenTrips}
            </div>
          </div>

          <div className="dashboard-stat">
            <div className="dashboard-stat-label">
              Saldo a receber
            </div>
            <div className="dashboard-stat-num">
              {loading ? "—" : brCurrency(totalSaldoAReceber)}
            </div>
          </div>
          <div className="dashboard-stat">
            <div className="dashboard-stat-label">Total de usuários</div>
            <div className="dashboard-stat-num">
              {loading ? "—" : totalUsers}
            </div>
          </div>
        </div>

        {/* Últimos cadastrados */}
        <div className="card dashboard-sub-card">
          <div className="card-head dashboard-sub-head">
            <div>
              <h3 className="dashboard-sub-title">Últimos cadastrados</h3>
              <p className="muted">
                Mostrando até 5 usuários cadastrados mais recentemente
              </p>
            </div>
          </div>
          <div className="dashboard-table-wrap">
            <table className="table table-striped dashboard-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Placa</th>
                  <th>Função</th>
                  <th>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {!loading && latest.length === 0 && (
                  <tr>
                    <td colSpan="4" className="muted dashboard-center-cell">
                      Nenhum usuário cadastrado ainda.
                    </td>
                  </tr>
                )}
                {latest.map((u) => (
                  <tr key={u._id}>
                    <td>{u.name || "-"}</td>
                    <td>{u.email || "-"}</td>
                    <td>{roleLabel[u.role] || "-"}</td>
                    <td>{formatDateTime(u.createdAt)}</td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan="4" className="muted dashboard-center-cell">
                      Carregando…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
