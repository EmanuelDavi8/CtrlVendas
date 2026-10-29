package com.vendas.controller;

import com.vendas.modelo.ProdutoModelo;
import com.vendas.modelo.UsuarioModelo;
import com.vendas.repository.ProdutoRepository;
import com.vendas.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/produtos")
@CrossOrigin(origins = "*")
public class ProdutoController {

    private final ProdutoRepository produtoRepository;
    private final UsuarioRepository usuarioRepository;

    public ProdutoController(ProdutoRepository produtoRepository, UsuarioRepository usuarioRepository) {
        this.produtoRepository = produtoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @GetMapping
    public List<ProdutoModelo> listarTodos() {
        return produtoRepository.findAll();
    }

@GetMapping("/usuario/{usuarioId}")
    public List<ProdutoModelo> listarPorUsuario(@PathVariable Long usuarioId) {
        UsuarioModelo usuario = usuarioRepository.findById(usuarioId).orElse(null);

        if (usuario != null && "VENDEDOR".equalsIgnoreCase(usuario.getTipo()) && usuario.getAdministrador() != null) {
            // Vendor sees products of their admin and shared products (null user)
            return produtoRepository.findByUsuario_IdOrUsuarioIsNull(usuario.getAdministrador().getId());
        }

        // Admin or other users see their own products and shared products
        return produtoRepository.findByUsuario_IdOrUsuarioIsNull(usuarioId);
    }

    @PostMapping
    public ResponseEntity<?> salvar(@RequestBody Map<String, Object> body) {
        try {
            Long usuarioId = Long.valueOf(body.get("usuarioId").toString());
            UsuarioModelo usuario = usuarioRepository.findById(usuarioId)
                    .orElseThrow(() -> new RuntimeException("Utilizador não encontrado: " + usuarioId));

            UsuarioModelo donoProduto = usuario;
            if ("VENDEDOR".equalsIgnoreCase(usuario.getTipo()) && usuario.getAdministrador() != null) {
                donoProduto = usuario.getAdministrador();
            }

            ProdutoModelo produto = new ProdutoModelo();
            produto.setNome((String) body.get("nome"));
            produto.setCategoria((String) body.getOrDefault("categoria", "Geral"));
            produto.setSku((String) body.getOrDefault("sku", ""));

            String fotoRecebida = (String) body.getOrDefault("fotoUrl", "");
            produto.setFotoUrl(fotoRecebida);

            Object precoObj = body.get("preco");
            produto.setPreco(precoObj != null
                    ? new java.math.BigDecimal(precoObj.toString())
                    : java.math.BigDecimal.ZERO);

            // Captura correta do preço de custo ao criar
            Object custoObj = body.get("precoCusto");
            produto.setPrecoCusto(custoObj != null
                    ? new java.math.BigDecimal(custoObj.toString())
                    : java.math.BigDecimal.ZERO);

            Object qtyObj = body.get("quantidadeEstoque");
            produto.setQuantidadeEstoque(qtyObj != null ? Integer.parseInt(qtyObj.toString()) : 0);

            Object minObj = body.get("quantidadeMinima");
            produto.setQuantidadeMinima(minObj != null ? Integer.parseInt(minObj.toString()) : 0);

            produto.setUsuario(donoProduto);
            return ResponseEntity.status(HttpStatus.CREATED).body(produtoRepository.save(produto));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> atualizar(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return produtoRepository.findById(id)
                .map(produto -> {
                    if (body.containsKey("nome"))
                        produto.setNome((String) body.get("nome"));
                    if (body.containsKey("categoria"))
                        produto.setCategoria((String) body.get("categoria"));
                    if (body.containsKey("sku"))
                        produto.setSku((String) body.get("sku"));
                    if (body.containsKey("fotoUrl"))
                        produto.setFotoUrl((String) body.get("fotoUrl"));

                    if (body.containsKey("preco"))
                        produto.setPreco(new java.math.BigDecimal(body.get("preco").toString()));

                    // Captura correta do preço de custo ao atualizar
                    if (body.containsKey("precoCusto"))
                        produto.setPrecoCusto(new java.math.BigDecimal(body.get("precoCusto").toString()));

                    if (body.containsKey("quantidadeEstoque"))
                        produto.setQuantidadeEstoque(Integer.parseInt(body.get("quantidadeEstoque").toString()));
                    if (body.containsKey("quantidadeMinima"))
                        produto.setQuantidadeMinima(Integer.parseInt(body.get("quantidadeMinima").toString()));

                    return ResponseEntity.ok(produtoRepository.save(produto));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        if (!produtoRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        produtoRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}