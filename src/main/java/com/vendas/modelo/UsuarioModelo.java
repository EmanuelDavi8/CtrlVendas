package com.vendas.modelo;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;
import jakarta.persistence.*;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsuarioModelo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nomeCompleto;

    @Column(nullable = false)
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String senha;

    @Column(nullable = false, unique = true, length = 14)
    private String cpf;

    private String nomeEmpresa;

    @Column(unique = true, length = 18)
    private String cnpj;

    @Column(nullable = false)
    @Pattern(regexp = "ADMIN|VENDEDOR", message = "O tipo de usuário deve ser ADMIN ou VENDEDOR")
    private String tipo;

    // Novo campo para controlar se o vendedor foi aprovado ou está pendente
    @Column(nullable = false)
    private String status = "APROVADO"; // Admins entram aprovados por padrão

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    @NotFound(action = NotFoundAction.IGNORE)
    private UsuarioModelo administrador;

    @OneToMany(mappedBy = "usuario", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<ProdutoModelo> produtos = new ArrayList<>();
}