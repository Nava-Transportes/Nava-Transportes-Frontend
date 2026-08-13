import React, { useEffect, useState } from "react";
import api from "../../../services/api";
import "./AdminPayments.css";

const n = (v) => (isNaN(Number(v)) ? 0 : Number(v));
const brCurrency = (v) =>
  n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toDateTimeLocal = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 16);
};

export default function AdminPayments() {
  const [drivers, setDrivers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [driverId, setDriverId] = useState("");
  const [amount, setAmount] = useState("");
  const [proofSent, setProofSent] = useState(false);
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState("");

  const [fDriver, setFDriver] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const resetForm = () => {
    setEditingId("");
    setDriverId("");
    setAmount("");
    setProofSent(false);
    setNote("");
    setPaidAt("");
  };

  const loadDrivers = async () => {
    try {
      const { data } = await api.get("/admin/users", {
        params: { role: "driver", limit: 200 },
      });
      setDrivers(data.items || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Erro ao carregar motoristas.");
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      setErr("");

      const { data } = await api.get("/admin/payments", {
        params: {
          driverId: fDriver || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });

      setItems(data.items || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Erro ao carregar pagamentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!driverId) {
      setErr("Selecione o motorista.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setErr("Informe um valor maior que zero.");
      return;
    }

    if (!paidAt) {
      setErr("Informe a data do pagamento.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        driverId,
        amount: Number(amount),
        proofSent: !!proofSent,
        note: note.trim(),
        paidAt: new Date(paidAt).toISOString(),
      };

      if (editingId) {
        await api.put(`/admin/payments/${editingId}`, payload);
        setOk("Pagamento atualizado com sucesso.");
      } else {
        await api.post("/admin/payments", payload);
        setOk("Pagamento registrado com sucesso.");
      }

      resetForm();
      await loadPayments();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Erro ao salvar pagamento.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (payment) => {
    setErr("");
    setOk("");
    setEditingId(payment._id);
    setDriverId(payment.driverId || "");
    setAmount(payment.amount ?? "");
    setProofSent(payment.proofSent === true);
    setNote(payment.note || "");
    setPaidAt(toDateTimeLocal(payment.paidAt));

    window.requestAnimationFrame(() => {
      document
        .getElementById("admin-payment-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const cancelEdit = () => {
    resetForm();
    setErr("");
    setOk("");
  };

  const removePayment = async (payment) => {
    const confirmed = window.confirm(
      `Deseja excluir o pagamento de ${brCurrency(payment.amount)} para "${
        payment.driverName || "o motorista"
      }"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(payment._id);
      setErr("");
      setOk("");

      await api.delete(`/admin/payments/${payment._id}`);

      if (editingId === payment._id) {
        resetForm();
      }

      setOk("Pagamento excluído com sucesso.");
      await loadPayments();
    } catch (e) {
      setErr(e?.response?.data?.message || "Erro ao excluir pagamento.");
    } finally {
      setDeletingId("");
    }
  };

  const submitFilters = (e) => {
    e.preventDefault();
    loadPayments();
  };

  return (
    <div className="admin-payments-page">
      <div className="admin-payments-card">
        <div className="admin-payments-head">
          <div>
            <h2>Pagamentos PIX</h2>
            <p className="admin-payments-muted">
              Cadastre, edite e exclua os pagamentos enviados aos motoristas.
            </p>
          </div>
        </div>

        {err && <div className="admin-payments-alert error">{err}</div>}
        {ok && <div className="admin-payments-alert success">{ok}</div>}

        <form
          id="admin-payment-form"
          className={`admin-payments-form ${editingId ? "is-editing" : ""}`}
          onSubmit={submit}
        >
          <div className="admin-payments-form-title">
            <div>
              <h3>{editingId ? "Editar pagamento" : "Novo pagamento"}</h3>
              {editingId && <span>Altere os dados e salve para atualizar.</span>}
            </div>
            {editingId && (
              <span className="admin-payments-edit-badge">Em edição</span>
            )}
          </div>

          <div className="admin-payments-form-grid">
            <div className="admin-payments-field">
              <label className="admin-payments-label">Motorista</label>
              <select
                className="admin-payments-control"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                required
                disabled={saving}
              >
                <option value="">Selecione o motorista</option>
                {drivers.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name || d.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-payments-field">
              <label className="admin-payments-label">Valor pago</label>
              <input
                className="admin-payments-control"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="admin-payments-field">
              <label className="admin-payments-label">Data do pagamento</label>
              <input
                className="admin-payments-control"
                type="datetime-local"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="admin-payments-field admin-payments-field-full">
              <label className="admin-payments-check">
                <input
                  type="checkbox"
                  checked={proofSent}
                  onChange={(e) => setProofSent(e.target.checked)}
                  disabled={saving}
                />
                Comprovante enviado
              </label>
            </div>

            <div className="admin-payments-field admin-payments-field-full">
              <label className="admin-payments-label">Observações</label>
              <textarea
                className="admin-payments-control"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </div>
          </div>

          <div className="admin-payments-actions">
            {editingId && (
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancelar edição
              </button>
            )}
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving
                ? "Salvando..."
                : editingId
                  ? "Salvar alterações"
                  : "Registrar pagamento"}
            </button>
          </div>
        </form>

        <div className="admin-payments-separator" />

        <div className="admin-payments-subhead">
          <div>
            <h3>Pagamentos registrados</h3>
            <p className="admin-payments-muted">
              Use os filtros para localizar um pagamento.
            </p>
          </div>
        </div>

        <form className="admin-payments-filters" onSubmit={submitFilters}>
          <div className="admin-payments-filters-grid">
            <div className="admin-payments-field">
              <label className="admin-payments-label">Motorista</label>
              <select
                className="admin-payments-control"
                value={fDriver}
                onChange={(e) => setFDriver(e.target.value)}
              >
                <option value="">Todos os motoristas</option>
                {drivers.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name || d.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-payments-field">
              <label className="admin-payments-label">Data inicial</label>
              <input
                className="admin-payments-control"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div className="admin-payments-field">
              <label className="admin-payments-label">Data final</label>
              <input
                className="admin-payments-control"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            <div className="admin-payments-filter-actions">
              <button className="btn btn-secondary" type="submit" disabled={loading}>
                {loading ? "Filtrando..." : "Filtrar"}
              </button>
            </div>
          </div>
        </form>

        {loading ? (
          <p className="admin-payments-muted">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="admin-payments-empty">
            Nenhum pagamento encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="admin-payments-table-wrap">
            <table className="admin-payments-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Motorista</th>
                  <th>Valor</th>
                  <th>Comprovante</th>
                  <th>Observações</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {items.map((payment) => (
                  <tr key={payment._id}>
                    <td data-label="Data">
                      {new Date(payment.paidAt).toLocaleString("pt-BR")}
                    </td>
                    <td data-label="Motorista">{payment.driverName || "-"}</td>
                    <td data-label="Valor">{brCurrency(payment.amount)}</td>
                    <td data-label="Comprovante">
                      <span
                        className={`admin-payments-proof ${
                          payment.proofSent ? "sent" : "pending"
                        }`}
                      >
                        {payment.proofSent ? "Enviado" : "Pendente"}
                      </span>
                    </td>
                    <td data-label="Observações" className="admin-payments-note">
                      {payment.note || "-"}
                    </td>
                    <td data-label="Ações" className="admin-payments-row-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => startEdit(payment)}
                        disabled={saving || deletingId === payment._id}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removePayment(payment)}
                        disabled={saving || deletingId === payment._id}
                      >
                        {deletingId === payment._id ? "Excluindo..." : "Excluir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
