package com.vendas.controller;

import com.vendas.modelo.*;
import com.vendas.repository.*;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/vendas")
public class VendaController {

    private final VendaRepository vendaRepository;
    private final ProdutoRepository produtoRepository;
    private final UsuarioRepository usuarioRepository;
    private final EntityManager entityManager;

    public VendaController(VendaRepository vendaRepository,
            ProdutoRepository produtoRepository,
            UsuarioRepository usuarioRepository,
            EntityManager entityManager) {
        this.vendaRepository = vendaRepository;
        this.produtoRepository = produtoRepository;
        this.usuarioRepository = usuarioRepository;
        this.entityManager = entityManager;
    }

    @GetMapping
    public ResponseEntity<?> listarVendas(
            @RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) String tipo) {

        try {
            List<VendaModelo> vendas;
            org.springframework.data.domain.Sort sort = org.springframework.data.domain.Sort
                    .by(org.springframework.data.domain.Sort.Direction.DESC, "dataHora");

            if ("ADMIN".equalsIgnoreCase(tipo)) {
                vendas = vendaRepository.findAll(sort);
            } else if (usuarioId != null) {
                try {
                    vendas = vendaRepository.findByUsuarioIdOrderByDataHoraDesc(usuarioId);
                } catch (Exception ex) {
                    vendas = vendaRepository.findAll(sort);
                }
            } else {
                vendas = vendaRepository.findAll(sort);
            }

            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");
            List<Map<String, Object>> result = vendas.stream().map(v -> {
                Map<String, Object> tx = new LinkedHashMap<>();
                tx.put("id", v.getId());
                tx.put("dataHora", v.getDataHora() != null ? v.getDataHora().format(fmt) : "");
                tx.put("status", v.getStatus() != null ? v.getStatus() : "Concluída");

                BigDecimal totalVenda = v.getTotal() != null ? v.getTotal() : BigDecimal.ZERO;
                tx.put("total", totalVenda.doubleValue());

                Long uId = null;
                String nomeVendedorFinal = "Administrador";
                if (v.getNomeVendedor() != null && !v.getNomeVendedor().isBlank()) {
                    nomeVendedorFinal = v.getNomeVendedor();
                }

                try {
                    if (v.getUsuario() != null) {
                        uId = v.getUsuario().getId();
                        if ((v.getNomeVendedor() == null || v.getNomeVendedor().isBlank())
                                && v.getUsuario().getNomeCompleto() != null) {
                            nomeVendedorFinal = v.getUsuario().getNomeCompleto();
                        }
                    }
                } catch (Exception e) {
                }

                String nomeLower = nomeVendedorFinal != null ? nomeVendedorFinal.toLowerCase() : "";
                if (nomeLower.contains("admin") || nomeLower.contains("administrador")) {
                    nomeVendedorFinal = "Administrador";
                }

                tx.put("usuarioId", uId);
                tx.put("userId", uId);
                tx.put("nomeVendedor", nomeVendedorFinal);

                List<Map<String, Object>> items = new ArrayList<>();
                if (v.getItems() != null) {
                    items = v.getItems().stream().map(it -> {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("nome", it.getNomeProduto() != null ? it.getNomeProduto() : "Produto");
                        item.put("sku", it.getSku() != null ? it.getSku() : "");
                        item.put("icon", it.getIcon() != null ? it.getIcon() : "inventory_2");

                        BigDecimal precoUnit = it.getPrecoUnit() != null ? it.getPrecoUnit() : BigDecimal.ZERO;
                        item.put("precoUnit", precoUnit.doubleValue());
                        item.put("quantidade", it.getQuantidade() != null ? it.getQuantidade() : 0);

                        BigDecimal totalItem = it.getTotal() != null ? it.getTotal() : BigDecimal.ZERO;
                        item.put("total", totalItem.doubleValue());

                        return item;
                    }).collect(Collectors.toList());
                }

                tx.put("items", items);
                return tx;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(Collections.emptyList());
        }
    }

    @GetMapping("/usuario/{usuarioId}")
    public ResponseEntity<?> listarPorUsuario(@PathVariable Long usuarioId) {
        return listarVendas(usuarioId, null);
    }

    @GetMapping("/relatorio/financeiro")
    public ResponseEntity<?> obterRelatorioFinanceiro(
            @RequestParam(required = false, defaultValue = "tudo") String periodo,
            @RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) String tipo) {
        try {
            List<ProdutoModelo> produtos = produtoRepository.findAll();
            List<VendaModelo> vendas;
            if ("ADMIN".equalsIgnoreCase(tipo) || usuarioId == null) {
                vendas = vendaRepository.findAll();
            } else {
                try {
                    vendas = vendaRepository.findByUsuarioIdOrderByDataHoraDesc(usuarioId);
                } catch (Exception ex) {
                    vendas = vendaRepository.findAll();
                }
            }
            LocalDateTime agora = LocalDateTime.now();

            BigDecimal cmvHistoricoTotal = BigDecimal.ZERO;
            for (VendaModelo v : vendas) {
                if (v.getItems() != null) {
                    for (VendaItemModelo item : v.getItems()) {
                        BigDecimal custoUnit = item.getPrecoCusto() != null ? item.getPrecoCusto() : BigDecimal.ZERO;
                        int qtd = item.getQuantidade() != null ? item.getQuantidade() : 0;
                        cmvHistoricoTotal = cmvHistoricoTotal.add(custoUnit.multiply(BigDecimal.valueOf(qtd)));
                    }
                }
            }

            BigDecimal custoEstoqueAtual = produtos.stream()
                    .map(p -> {
                        BigDecimal custo = p.getPrecoCusto() != null ? p.getPrecoCusto() : BigDecimal.ZERO;
                        int qtd = p.getQuantidadeEstoque() != null ? p.getQuantidadeEstoque() : 0;
                        return custo.multiply(BigDecimal.valueOf(qtd));
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal custoTotalInvestido = cmvHistoricoTotal.add(custoEstoqueAtual);

            List<VendaModelo> vendasFiltradas = vendas.stream().filter(v -> {
                if (v.getDataHora() == null)
                    return false;
                if ("hoje".equalsIgnoreCase(periodo)) {
                    return v.getDataHora().toLocalDate().isEqual(agora.toLocalDate());
                } else if ("semana".equalsIgnoreCase(periodo)) {
                    LocalDateTime inicioSemana = agora.minusDays(7);
                    return v.getDataHora().isAfter(inicioSemana);
                } else if ("mes".equalsIgnoreCase(periodo)) {
                    return v.getDataHora().getMonth() == agora.getMonth()
                            && v.getDataHora().getYear() == agora.getYear();
                }
                return true;
            }).collect(Collectors.toList());

            int quantidadeVendasPeriodo = vendasFiltradas.size();

            BigDecimal faturamentoTotal = BigDecimal.ZERO;
            BigDecimal cmvTotalPeriodo = BigDecimal.ZERO;

            for (VendaModelo venda : vendasFiltradas) {
                if (venda.getTotal() != null) {
                    faturamentoTotal = faturamentoTotal.add(venda.getTotal());
                }

                if (venda.getItems() != null) {
                    for (VendaItemModelo item : venda.getItems()) {
                        BigDecimal custoUnit = BigDecimal.ZERO;

                        if (item.getPrecoCusto() != null && item.getPrecoCusto().compareTo(BigDecimal.ZERO) > 0) {
                            custoUnit = item.getPrecoCusto();
                        } else {
                            Optional<ProdutoModelo> prodOpt = produtos.stream()
                                    .filter(p -> p.getNome() != null
                                            && p.getNome().equalsIgnoreCase(item.getNomeProduto()))
                                    .findFirst();

                            if (prodOpt.isPresent() && prodOpt.get().getPrecoCusto() != null) {
                                custoUnit = prodOpt.get().getPrecoCusto();
                            }
                        }

                        int qtd = item.getQuantidade() != null ? item.getQuantidade() : 0;
                        cmvTotalPeriodo = cmvTotalPeriodo.add(custoUnit.multiply(BigDecimal.valueOf(qtd)));
                    }
                }
            }

            BigDecimal lucroBruto = faturamentoTotal.subtract(cmvTotalPeriodo);

            BigDecimal margemLucro = BigDecimal.ZERO;
            if (faturamentoTotal.compareTo(BigDecimal.ZERO) > 0) {
                margemLucro = lucroBruto
                        .divide(faturamentoTotal, 4, java.math.RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
            }

            String dataUltimoGasto = "Atualizado recentemente";

            Map<String, Object> relatorio = new LinkedHashMap<>();
            relatorio.put("custoTotalEstoque", custoTotalInvestido.doubleValue());
            relatorio.put("faturamentoTotal", faturamentoTotal.doubleValue());
            relatorio.put("cmvTotal", cmvTotalPeriodo.doubleValue());
            relatorio.put("lucroBruto", lucroBruto.doubleValue());
            relatorio.put("margemLucroPercentual", margemLucro.doubleValue());
            relatorio.put("quantidadeVendas", quantidadeVendasPeriodo);
            relatorio.put("dataUltimoGasto", dataUltimoGasto);

            return ResponseEntity.ok(relatorio);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/destaque")
    public ResponseEntity<?> obterDestaqueVendas() {
        try {
            List<VendaModelo> todasVendas = vendaRepository.findAll();
            Map<String, BigDecimal> totalPorVendedor = new HashMap<>();

            for (VendaModelo v : todasVendas) {
                String nomeVendedor = v.getNomeVendedor();
                if (nomeVendedor == null || nomeVendedor.isBlank())
                    continue;

                String nomeLimpo = nomeVendedor.trim();
                String nomeLower = nomeLimpo.toLowerCase();

                // EXCLUSÃO RIGOROSA: Ignora qualquer variação de admin, administrador ou
                // utilizadores sem nome de vendedor válido
                if (nomeLower.contains("admin") || nomeLower.contains("administrador")
                        || nomeLower.equals("vendedor")) {
                    continue;
                }

                BigDecimal total = v.getTotal() != null ? v.getTotal() : BigDecimal.ZERO;
                totalPorVendedor.merge(nomeLimpo, total, BigDecimal::add);
            }

            String melhorNome = null;
            BigDecimal maiorValor = BigDecimal.ZERO;
            for (Map.Entry<String, BigDecimal> e : totalPorVendedor.entrySet()) {
                if (e.getValue().compareTo(maiorValor) > 0) {
                    maiorValor = e.getValue();
                    melhorNome = e.getKey();
                }
            }

            if (melhorNome == null || maiorValor.compareTo(BigDecimal.ZERO) == 0) {
                return ResponseEntity.ok(Map.of("nome", "Nenhum", "total", 0));
            }

            String[] partes = melhorNome.split(" ");
            String nomeCurto = partes.length > 1 ? partes[0] + " " + partes[1] : melhorNome;

            return ResponseEntity.ok(Map.of("nome", nomeCurto, "total", maiorValor.doubleValue()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> registrarVenda(@RequestBody Map<String, Object> body) {
        try {
            Long usuarioId = null;
            if (body.containsKey("usuarioId") && body.get("usuarioId") != null) {
                usuarioId = Long.valueOf(body.get("usuarioId").toString());
            } else if (body.containsKey("userId") && body.get("userId") != null) {
                usuarioId = Long.valueOf(body.get("userId").toString());
            }

            if (usuarioId == null) {
                throw new RuntimeException("ID do utilizador é obrigatório para registrar a venda");
            }

            UsuarioModelo usuario = usuarioRepository.findById(usuarioId)
                    .orElseThrow(() -> new RuntimeException("Utilizador não encontrado"));

            String orderId = body.get("orderId").toString();
            BigDecimal total = new BigDecimal(body.get("total").toString());

            LocalDateTime dataHoraVenda = LocalDateTime.now();
            if (body.containsKey("dataVenda") && body.get("dataVenda") != null) {
                String dataStr = body.get("dataVenda").toString().trim();
                try {
                    if (dataStr.length() == 10) {
                        java.time.LocalDate localDate = java.time.LocalDate.parse(dataStr);
                        dataHoraVenda = localDate.atTime(LocalDateTime.now().toLocalTime());
                    } else {
                        dataHoraVenda = LocalDateTime.parse(dataStr);
                    }
                } catch (Exception e) {
                    dataHoraVenda = LocalDateTime.now();
                }
            }

            VendaModelo venda = new VendaModelo();
            venda.setId(orderId);
            venda.setDataHora(dataHoraVenda);
            venda.setStatus("Concluída");
            venda.setTotal(total);
            venda.setUsuario(usuario);

            String nomeVend = usuario.getNomeCompleto() != null ? usuario.getNomeCompleto() : "Vendedor";
            if (body.containsKey("nomeVendedor") && body.get("nomeVendedor") != null
                    && !body.get("nomeVendedor").toString().isBlank()) {
                nomeVend = body.get("nomeVendedor").toString().trim();
            }

            String nomeLower = nomeVend.toLowerCase();
            if (nomeLower.contains("admin") || nomeLower.contains("administrador")) {
                nomeVend = "Administrador";
            }
            venda.setNomeVendedor(nomeVend);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> itemsPayload = (List<Map<String, Object>>) body.get("items");

            Map<Long, Map<String, Object>> itensAgrupadosMap = new LinkedHashMap<>();
            if (itemsPayload != null) {
                for (Map<String, Object> i : itemsPayload) {
                    Long productId = Long.valueOf(i.get("productId").toString());
                    int qty = Integer.parseInt(i.get("quantity").toString());
                    BigDecimal precoUnit = new BigDecimal(i.get("preco").toString());

                    if (itensAgrupadosMap.containsKey(productId)) {
                        Map<String, Object> existente = itensAgrupadosMap.get(productId);
                        int qtdExistente = (int) existente.get("quantity");
                        int novaQtd = qtdExistente + qty;
                        existente.put("quantity", novaQtd);
                        existente.put("subtotal", precoUnit.multiply(BigDecimal.valueOf(novaQtd)));
                    } else {
                        Map<String, Object> novoItem = new HashMap<>(i);
                        novoItem.put("quantity", qty);
                        novoItem.put("subtotal", precoUnit.multiply(BigDecimal.valueOf(qty)));
                        itensAgrupadosMap.put(productId, novoItem);
                    }
                }
            }

            List<VendaItemModelo> items = new ArrayList<>();
            for (Map.Entry<Long, Map<String, Object>> entry : itensAgrupadosMap.entrySet()) {
                Long productId = entry.getKey();
                Map<String, Object> i = entry.getValue();

                VendaItemModelo item = new VendaItemModelo();
                item.setVenda(venda);
                item.setNomeProduto(i.get("nome").toString());
                item.setSku(i.containsKey("sku") && i.get("sku") != null ? i.get("sku").toString() : "");
                item.setIcon(i.containsKey("icon") && i.get("icon") != null ? i.get("icon").toString() : "inventory_2");

                BigDecimal precoUnit = new BigDecimal(i.get("preco").toString());
                item.setPrecoUnit(precoUnit);

                int qty = Integer.parseInt(i.get("quantity").toString());
                item.setQuantidade(qty);
                item.setTotal(new BigDecimal(i.get("subtotal").toString()));

                produtoRepository.findById(productId).ifPresent(prod -> {
                    BigDecimal custoUnit = prod.getPrecoCusto() != null ? prod.getPrecoCusto() : BigDecimal.ZERO;
                    item.setPrecoCusto(custoUnit);

                    int novoQty = Math.max(0, prod.getQuantidadeEstoque() - qty);
                    prod.setQuantidadeEstoque(novoQty);
                    produtoRepository.save(prod);
                });

                items.add(item);
            }

            venda.setItems(items);
            vendaRepository.save(venda);

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("orderId", orderId));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}