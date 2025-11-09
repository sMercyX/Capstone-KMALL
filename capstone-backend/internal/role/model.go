package role

type Role struct {
	ID   int32   `db:"role_id"   json:"id"`
	Name string  `db:"role_name" json:"name"`
	Desc *string `db:"role_desc" json:"desc,omitempty"`
}
