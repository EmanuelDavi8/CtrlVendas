package com.vendas.controller;

import com.vendas.modelo.VendaModelo;
import com.vendas.repository.VendaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.bind.annotation.RequestParam;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class DestaqueController {

    private final VendaRepository vendaRepository;

    public DestaqueController(VendaRepository vendaRepository) {
        this.vendaRepository = vendaRepository;
    }

    /**
     * Endpoint to obtain the top seller excluding administrators.
     */
    @GetMapping("/destaque")
    public ResponseEntity<?> obterDestaqueVendas(@RequestParam(value = "date", required = false) String dateStr) {
        try {
            List<VendaModelo> todasVendas = vendaRepository.findAll();
            // Parse optional date filter (ISO yyyy-MM-dd)
            java.time.LocalDate filterDate = null;
            if (dateStr != null && !dateStr.isBlank()) {
                filterDate = java.time.LocalDate.parse(dateStr);
            }
            Map<String, Integer> contagemPorVendedor = new HashMap<>();
            for (VendaModelo v : todasVendas) {
                // Apply date filter if provided
                if (filterDate != null) {
                    if (v.getDataHora() == null || !v.getDataHora().toLocalDate().equals(filterDate)) {
                        continue;
                    }
                }
                // Excluir vendas feitas por ADMIN (by user type)
                if (v.getUsuario() != null && "ADMIN".equalsIgnoreCase(v.getUsuario().getTipo())) {
                    continue;
                }
                String nomeVendedor = v.getNomeVendedor();
                if (nomeVendedor == null || nomeVendedor.isBlank())
                    continue;
                String nomeLower = nomeVendedor.toLowerCase();
                if (nomeLower.contains("admin") || nomeLower.contains("administrador")) {
                    continue; // extra safety
                }
                contagemPorVendedor.merge(nomeVendedor, 1, Integer::sum);
            }
            String melhorNome = null;
            int maiorContagem = 0;
            for (Map.Entry<String, Integer> e : contagemPorVendedor.entrySet()) {
                if (e.getValue() > maiorContagem) {
                    maiorContagem = e.getValue();
                    melhorNome = e.getKey();
                }
            }
            if (melhorNome == null) {
                return ResponseEntity.ok(Map.of("nome", "Nenhum", "total", 0));
            }
            String[] partes = melhorNome.split(" ");
            String nomeCurto = partes.length > 1 ? partes[0] + " " + partes[1] : melhorNome;
            return ResponseEntity.ok(Map.of("nome", nomeCurto, "total", maiorContagem));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
