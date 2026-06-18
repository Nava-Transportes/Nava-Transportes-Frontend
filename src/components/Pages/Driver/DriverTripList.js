import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../../../services/api";
import "./DriverTripList.css";

const n = (v) => (isNaN(Number(v)) ? 0 : Number(v));
const brCurrency = (v) =>
  n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STORAGE_KEY = "driver_trip_draft";
const VIEW_STORAGE_KEY = "driver_trip_view";
const FORM_ROUTE = "/driver/trips/new"; // ajuste se a rota do formulário for outra

export default function DriverTripList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit] = useState(false);
  
  // const [allowBackdropClose, setAllowBackdropClose] = useState(false);
  // const [editError, setEditError] = useState("");
  // const [editingTrip, setEditingTrip] = useState(null);
  // const [fPlate, setFPlate] = useState("");
  // const [fKmInicial, setFKmInicial] = useState(0);
  // const [fKmFinal, setFKmFinal] = useState(0);
  // const [fTotalFrete, setFTotalFrete] = useState(0);
  // const [fPremiacao, setFPremiacao] = useState(0);

  const formatDateTime = (v) => {
    if (!v) return "-";
    try {
      return new Date(v).toLocaleString("pt-BR");
    } catch {
      return "-";
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setErr("");

      const { data } = await api.get("/driver/trips");

      const finalizados = (data.items || []).map((item) => ({
        ...item,
        tipoRegistro: "finalizado",
      }));

      let rascunhos = [];

      const savedDraft = localStorage.getItem(STORAGE_KEY);

      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);

          if (parsed?.rows?.length) {
            const rows = parsed.rows || [];

            const kmInicial = rows.length ? n(rows[0].kmInicial) : 0;
            const kmFinal = rows.length ? n(rows[rows.length - 1].kmFinal) : 0;
            const totalDoFrete = rows.reduce((s, r) => s + n(r.frete), 0);
            const premiacaoValor = +(
              totalDoFrete *
              (n(parsed.premiacao) / 100)
            ).toFixed(2);

            rascunhos.push({
              _id: "local-draft",
              tipoRegistro: "rascunho",
              plate: parsed.plate || "-",
              kmInicial,
              kmFinal,
              totalDoFrete,
              premiacaoValor,
              trechos: rows,
              updatedAt: parsed.updatedAt,
            });
          }
        } catch (e) {
          console.warn("Erro ao carregar rascunho local", e);
        }
      }

      setItems([...rascunhos, ...finalizados]);
    } catch (e) {
      setErr("Erro ao carregar viagens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // const openEditModal = (trip) => {
  //   setEditingTrip(trip);
  //   setEditError("");

  //   setFPlate(trip.plate || "");
  //   setFKmInicial(trip.kmInicial || 0);
  //   setFKmFinal(trip.kmFinal || 0);
  //   setFTotalFrete(trip.totalDoFrete || 0);
  //   setFPremiacao(trip.premiacao || 0);

  //   setEditOpen(true);
  //   setAllowBackdropClose(false);
  //   setTimeout(() => setAllowBackdropClose(true), 150);
  // };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditOpen(false);
  };

  useEffect(() => {
    if (!editOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeEditModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, savingEdit]);

  // const submitEdit = async (e) => {
  //   e.preventDefault();
  //   if (!editingTrip || savingEdit) return;

  //   setEditError("");
  //   setSavingEdit(true);

  //   try {
  //     const payload = {
  //       plate: fPlate.trim(),
  //       kmInicial: n(fKmInicial),
  //       kmFinal: n(fKmFinal),
  //       totalDoFrete: n(fTotalFrete),
  //       premiacao: n(fPremiacao),
  //     };

  //     await api.put(`/driver/trips/${editingTrip._id}`, payload);

  //     setEditOpen(false);
  //     await load();
  //   } catch (e2) {
  //     setEditError(
  //       e2?.response?.data?.message || "Erro ao atualizar viagem"
  //     );
  //   } finally {
  //     setSavingEdit(false);
  //   }
  // };

  // const handleDelete = async (trip) => {
  //   const ok = window.confirm(
  //     `Tem certeza que deseja excluir a viagem da placa "${trip.plate}"?`
  //   );
  //   if (!ok) return;

  //   try {
  //     await api.delete(`/driver/trips/${trip._id}`);
  //     await load();
  //   } catch (e2) {
  //     alert(e2?.response?.data?.message || "Erro ao excluir viagem");
  //   }
  // };

  const handleEditDraft = (trip) => {
    if (trip.tipoRegistro !== "rascunho") return;

      window.location.href = FORM_ROUTE;
    };

    const exportTripPDF = (trip) => {
    const doc = new jsPDF();

    const kmIni = n(trip.kmInicial);
    const kmFim = n(trip.kmFinal);
    const kmRodado = kmFim - kmIni;

    const trechos = trip.trechos || [];

    const totalSaldo = trechos.reduce((s, r) => s + n(r.saldo), 0);
    const totalAdiantado = trechos.reduce((s, r) => s + n(r.adiantamento), 0);
    const totalLitros = trechos.reduce((s, r) => s + n(r.litros), 0);

    const status =
      trip.tipoRegistro === "rascunho" ? "Rascunho" : "Finalizado";

    doc.setFontSize(16);
    doc.text("Relatório da Viagem", 14, 15);

    doc.setFontSize(10);
    doc.text(`Status: ${status}`, 14, 25);
    doc.text(`Placa: ${trip.plate || "-"}`, 14, 32);
    doc.text(`Data: ${formatDateTime(trechos?.[0]?.data)}`, 14, 39);
    doc.text(`KM Inicial: ${kmIni}`, 14, 46);
    doc.text(`KM Final: ${kmFim}`, 14, 53);
    doc.text(`KM Rodado: ${kmRodado}`, 14, 60);
    doc.text(`Total do Frete: ${brCurrency(trip.totalDoFrete || 0)}`, 14, 67);
    doc.text(`Valor: ${brCurrency(trip.premiacaoValor || 0)}`, 14, 74);
    doc.text(`Total Adiantado: ${brCurrency(totalAdiantado)}`, 14, 81);
    doc.text(`Saldo: ${brCurrency(totalSaldo)}`, 14, 88);
    doc.text(`Litros Total: ${totalLitros}`, 14, 95);

    autoTable(doc, {
      startY: 105,
      head: [[
        "Data",
        "Origem",
        "Destino",
        "Frete",
        "Adiant.",
        "Saldo",
        "KM Ini",
        "KM Fin",
        "Posto",
        "Litros",
        "Média"
      ]],
      body: trechos.map((r) => [
        r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "-",
        r.origem || "-",
        r.destino || "-",
        brCurrency(r.frete || 0),
        brCurrency(r.adiantamento || 0),
        brCurrency(r.saldo || 0),
        n(r.kmInicial),
        n(r.kmFinal),
        r.posto || "-",
        n(r.litros),
        n(r.mediaTrecho),
      ]),
      styles: {
        fontSize: 8,
      },
      headStyles: {
        fillColor: [40, 40, 40],
      },
    });

    const fileName = `viagem-${trip.plate || "sem-placa"}-${status}.pdf`;

    doc.save(fileName);
  };

  const handleViewTrip = (trip) => {
    localStorage.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({
        ...trip,
        viewMode: true,
      })
    );

    window.location.href = `${FORM_ROUTE}?mode=view`;
  };

  if (loading) {
    return (
      <div className="driver-page driver-trip-list-page">
        <div className="card driver-card">
          <div className="driver-trip-head">
            <h2>Minhas Viagens</h2>
            <p className="muted">Carregando suas viagens…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="driver-page driver-trip-list-page">
      <div className="card driver-card">
        <div className="driver-trip-head">
          <div>
            <h2>Minhas Viagens</h2>
            <p className="muted">Listagem de controles já enviados.</p>
          </div>
        </div>

        {err && <div className="alert error-alert">{err}</div>}

        {items.length === 0 ? (
          <p className="muted driver-trip-empty">
            Nenhuma viagem cadastrada.
          </p>
        ) : (
          <div className="driver-trip-table-wrap">
            <table className="table table-striped driver-trip-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Placa</th>
                  <th>KM Inicial</th>
                  <th>KM Final</th>
                  <th>KM Rodado</th>
                  <th>Total Frete</th>
                  <th>Valor</th>
                  <th>Saldo</th>
                  <th>Status</th>
                  <th className="driver-trip-actions-col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const kmIni = n(t.kmInicial);
                  const kmFim = n(t.kmFinal);
                  const kmRodado = kmFim - kmIni;

                  const totalSaldo = (t.trechos || []).reduce(
                    (s, r) => s + n(r.saldo),
                    0
                  );

                  return (
                    <tr
                      key={t._id}
                      className={
                        t.tipoRegistro === "rascunho"
                          ? "driver-trip-row-draft"
                          : "driver-trip-row-final"
                      }
                    >
                      <td>{formatDateTime(t.trechos?.[0]?.data) || "-"}</td>
                      <td>{t.plate || "-"}</td>
                      <td>{kmIni}</td>
                      <td>{kmFim}</td>
                      <td>{kmRodado}</td>
                      <td>{brCurrency(t.totalDoFrete || 0)}</td>
                      <td>{brCurrency(t.premiacaoValor || 0)}</td>
                      <td>
                        <b style={{ color: totalSaldo > 0 ? "#c62828" : "#555" }}>
                          {brCurrency(totalSaldo)}
                        </b>
                      </td>
                      <td>
                        <span
                          className={
                            t.tipoRegistro === "rascunho"
                              ? "driver-trip-status-draft"
                              : "driver-trip-status-final"
                          }
                        >
                          {t.tipoRegistro === "rascunho" ? "Rascunho" : "Finalizado"}
                        </span>
                      </td>

                      <td className="driver-trip-row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-warning"
                          onClick={() => handleEditDraft(t)}
                          disabled={t.tipoRegistro !== "rascunho"}
                          title={
                            t.tipoRegistro !== "rascunho"
                              ? "Viagem finalizada não pode ser editada"
                              : "Editar rascunho"
                          }
                        >
                          Editar
                        </button>

                        {t.tipoRegistro !== "rascunho" && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => exportTripPDF(t)}
                            style={{ marginLeft: "8px" }}
                          >
                            Exportar PDF
                          </button>
                        )}
                        {t.tipoRegistro !== "rascunho" && (
                          <button
                            type="button"
                            className="btn btn-sm btn-info"
                            onClick={() => handleViewTrip(t)}
                            style={{ marginLeft: "8px" }}
                          >
                            Ver detalhes
                          </button>
                        )}
                      </td>
                      {/* <td className="driver-trip-row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEditModal(t)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(t)}
                        >
                          Excluir
                        </button>
                      </td> */}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {/* {editOpen && (
        <div
          className="driver-modal"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (allowBackdropClose && e.target === e.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <div
            className="driver-modal-card pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="driver-modal-head">
              <h3>Editar viagem</h3>
              <button
                className="btn btn-sm btn-outline-light"
                type="button"
                onClick={closeEditModal}
                disabled={savingEdit}
              >
                Fechar
              </button>
            </div>

            <hr></hr>

            <form className="driver-modal-form" onSubmit={submitEdit}>
              <div className="form-field">
                <label>Placa</label>
                <input
                  className="form-control"
                  value={fPlate}
                  onChange={(e) => setFPlate(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="driver-modal-grid">
                <div className="form-field">
                  <label>KM Inicial</label>
                  <input
                    className="form-control"
                    type="number"
                    value={fKmInicial}
                    onChange={(e) => setFKmInicial(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>KM Final</label>
                  <input
                    className="form-control"
                    type="number"
                    value={fKmFinal}
                    onChange={(e) => setFKmFinal(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Total Frete</label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.01"
                    value={fTotalFrete}
                    onChange={(e) => setFTotalFrete(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Valor</label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.01"
                    value={fPremiacao}
                    onChange={(e) => setFPremiacao(e.target.value)}
                  />
                </div>
              </div>

              {editError && (
                <div className="alert error-alert">{editError}</div>
              )}

              <hr></hr>

              <div className="driver-modal-actions">
                <button
                  className="btn btn-outline-light"
                  type="button"
                  onClick={closeEditModal}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )} */}
    </div>
  );
}
