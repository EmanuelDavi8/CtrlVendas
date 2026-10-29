package com.vendas.modelo;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "produtos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProdutoModelo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private BigDecimal preco;

    @Column(name = "preco_custo")
    private BigDecimal precoCusto;

    @Column(nullable = false)
    private Integer quantidadeEstoque;

    @Column
    private Integer quantidadeMinima;

    @Column
    private String categoria;

    @Column
    private String sku;

    // Substituído ou adaptado para guardar a imagem em Base64
    @Column(columnDefinition = "TEXT")
    private String fotoUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    @NotFound(action = NotFoundAction.IGNORE)
    @JsonIgnore
    private UsuarioModelo usuario;

    @com.fasterxml.jackson.annotation.JsonProperty("usuarioId")
    public Long getUsuarioId() {
        return usuario != null ? usuario.getId() : null;
    }
}