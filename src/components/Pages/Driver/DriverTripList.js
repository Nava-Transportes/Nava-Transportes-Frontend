import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../../../services/api";
import { formatDateOnly } from "../../../utils/date";
import "./DriverTripList.css";

const n = (v) => (isNaN(Number(v)) ? 0 : Number(v));
const brCurrency = (v) =>
  n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const asArray = (v) => (Array.isArray(v) ? v : []);

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

      const serverItems = (data.items || []).map((item) => ({
        ...item,
        tipoRegistro: item.isDraft === true ? "rascunho" : "enviado",
      }));

      let rascunhos = [];

      const savedDraft = localStorage.getItem(STORAGE_KEY);
      const hasServerDraft = serverItems.some(
        (item) => item.tipoRegistro === "rascunho"
      );

      if (savedDraft && !hasServerDraft) {
        try {
          const parsed = JSON.parse(savedDraft);

          if (parsed?.rows?.length) {
            const rows = parsed.rows || [];

            const kmInicial = rows.length ? n(rows[0].kmInicial) : 0;
            const kmFinal = rows.length ? n(rows[rows.length - 1].kmFinal) : 0;
            const totalDoFrete = rows.reduce((s, r) => s + n(r.frete), 0);
            const litrosTotal = rows.reduce((s, r) => s + n(r.litros), 0);
            const litrosArlaTotal = rows.reduce(
              (s, r) => s + n(r.litrosArla),
              0
            );
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
              litrosTotal,
              litrosArlaTotal,
              premiacaoValor,
              trechos: rows,
              updatedAt: parsed.updatedAt,
            });
          }
        } catch (e) {
          console.warn("Erro ao carregar rascunho local", e);
        }
      }

      setItems([...rascunhos, ...serverItems]);
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
    if (!trip) return;

    const doc = new jsPDF();

    const trechos = asArray(trip.trechos);
    const extras = asArray(trip.extras);

    const kmIni = n(trip.kmInicial);
    const kmFim = n(trip.kmFinal);
    const kmRodado = kmFim - kmIni;

    const totalSaldo = trechos.reduce((s, r) => s + n(r.saldo), 0);
    const totalAdiantado = trechos.reduce((s, r) => s + n(r.adiantamento), 0);
    const totalLitros = trechos.reduce((s, r) => s + n(r.litros), 0);
    const totalLitrosArla = trechos.reduce(
      (s, r) => s + n(r.litrosArla),
      0
    );

    doc.setFontSize(16);
    doc.text("Relatório da Viagem", 14, 15);

    doc.setFontSize(10);

    // Bloco superior esquerdo
    let yLeft = 25;
    doc.text(`Motorista: ${trip.driverName || "-"}`, 14, yLeft);
    yLeft += 7;
    doc.text(`Empresa: ${trip.companyName || "-"}`, 14, yLeft);
    yLeft += 7;
    doc.text(`Placa: ${trip.plate || "-"}`, 14, yLeft);
    yLeft += 7;
    yLeft += 7;
    doc.text(`Criado em: ${formatDateTime(trip.createdAt)}`, 14, yLeft);

    // Bloco veículo
    let yVehicle = 70;
    doc.text(`KM Inicial: ${kmIni || "-"}`, 14, yVehicle);
    yVehicle += 7;
    doc.text(`KM Final: ${kmFim || "-"}`, 14, yVehicle);
    yVehicle += 7;
    doc.text(`KM Rodado: ${kmRodado || "-"}`, 14, yVehicle);
    yVehicle += 7;
    doc.text(`Diesel Total: ${totalLitros || "-"} L`, 14, yVehicle);
    yVehicle += 7;
    doc.text(`ARLA Total: ${totalLitrosArla || "-"} L`, 14, yVehicle);
    yVehicle += 7;
    doc.text(`Média Geral: ${trip.mediaGeral || "-"}`, 14, yVehicle);

    // Bloco financeiro
    let yFinance = 70;
    doc.text(
      `Total do Frete: ${brCurrency(trip.totalDoFrete || trip.totalFrete)}`,
      110,
      yFinance
    );
    yFinance += 7;
    doc.text(`Total Adiantado: ${brCurrency(totalAdiantado)}`, 110, yFinance);
    yFinance += 7;
    doc.text(`Saldo: ${brCurrency(totalSaldo)}`, 110, yFinance);
    yFinance += 7;
    doc.text(
      `Premiação: ${brCurrency(trip.premiacaoValor || 0)} (${trip.premiacaoPercentual || 0}%)`,
      110,
      yFinance
    );

    if (trip.latitude && trip.longitude) {
      yFinance += 7;
      doc.text(
        `Localização: ${Number(trip.latitude).toFixed(5)}, ${Number(trip.longitude).toFixed(5)}`,
        110,
        yFinance
      );
    }

    let startY = 110;

    if (extras.length > 0) {
      autoTable(doc, {
        startY,
        head: [["Extras", "Valor"]],
        body: extras.map((ex) => [
          ex.descricao || "-",
          brCurrency(ex.valor),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
      });

      startY = doc.lastAutoTable.finalY + 10;
    }

    autoTable(doc, {
      startY,
      head: [
        [
          "Data",
          "Origem",
          "Destino",
          "Frete",
          "Adiant.",
          "Saldo",
          "KM Ini",
          "KM Fin",
          "Posto",
          "Diesel",
          "ARLA",
        ],
      ],
      body: trechos.map((r) => [
        formatDateOnly(r.data),
        r.origem || "-",
        r.destino || "-",
        brCurrency(r.frete),
        brCurrency(r.adiantamento),
        brCurrency(r.saldo),
        n(r.kmInicial) || "-",
        n(r.kmFinal) || "-",
        r.posto || "-",
        n(r.litros) || "-",
        n(r.litrosArla) || "-",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    const fileName = `viagem-${trip.plate || "sem-placa"}-${trip.driverName || "motorista"}.pdf`
      .replace(/\s+/g, "-")
      .toLowerCase();

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
                  <th>Diesel total</th>
                  <th>ARLA total</th>
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
                      <td data-label="Data">{formatDateOnly(t.trechos?.[0]?.data)}</td>
                      <td data-label="Placa">{t.plate || "-"}</td>
                      <td data-label="KM Inicial">{kmIni}</td>
                      <td data-label="KM Final">{kmFim}</td>
                      <td data-label="KM Rodado">{kmRodado}</td>
                      <td data-label="Diesel total">{n(t.litrosTotal)} L</td>
                      <td data-label="ARLA total">{n(t.litrosArlaTotal)} L</td>
                      <td data-label="Total Frete">{brCurrency(t.totalDoFrete || 0)}</td>
                      <td data-label="Valor">{brCurrency(t.premiacaoValor || 0)}</td>
                      <td data-label="Saldo">
                        <b style={{ color: totalSaldo > 0 ? "#c62828" : "#555" }}>
                          {brCurrency(totalSaldo)}
                        </b>
                      </td>
                      <td data-label="Status">
                        <span
                          className={
                            t.tipoRegistro === "rascunho"
                              ? "driver-trip-status-draft"
                              : "driver-trip-status-final"
                          }
                        >
                          {t.tipoRegistro === "rascunho" ? "Rascunho" : "Viagem enviada"}
                        </span>
                      </td>

                      <td data-label="Ações" className="driver-trip-row-actions">
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
