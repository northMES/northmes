-- migration: expand
create table reads_planning.production_order_copy as select * from planning.production_order;
