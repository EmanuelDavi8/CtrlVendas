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
@Table(name = "venda_itens")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendaItemModelo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venda_id")
    @NotFound(action = NotFoundAction.IGNORE)
    @JsonIgnore
    private VendaModelo venda;

    @Column(name = "nome", nullable = false)
    private String nomeProduto;

    @Column(name = "sku")
    private String sku;

    @Column(name = "icon")
    private String icon;

    @Column(name = "preco_unitario", nullable = false)
    private BigDecimal precoUnit;

    // Adiciona este campo para guardar o custo histórico na venda
    @Column(name = "preco_custo")
    private BigDecimal precoCusto;

    @Column(name = "quantidade", nullable = false)
    private Integer quantidade;

    @Column(name = "subtotal", nullable = false)
    private BigDecimal total;
}